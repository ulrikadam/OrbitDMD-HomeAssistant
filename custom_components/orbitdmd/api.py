"""Client de la page web du panneau OrbitDMD (API HTTP locale, sans MQTT).

Lecture sans mot de passe : /api/etat, /api/gif, /api/gif/liste.
Commandes : formulaires multipart avec le champ "password" (Web_Password du panneau),
reponse texte "OK : ..." ou "ERREUR : ...".
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)
TIMEOUT = aiohttp.ClientTimeout(total=15)


class OrbitDMDError(Exception):
    """Panneau injoignable ou reponse inattendue."""


class OrbitDMDAuthError(OrbitDMDError):
    """Mot de passe refuse."""


class OrbitDMDApi:
    def __init__(self, session: aiohttp.ClientSession, host: str, password: str) -> None:
        self._session = session
        self.host = host.strip().removeprefix("http://").rstrip("/")
        self._password = password
        self._lock = asyncio.Lock()       # le panneau traite une demande a la fois
        self._gif_slots = asyncio.Semaphore(2)   # apercus des GIF : deux a la fois au plus

    @property
    def base(self) -> str:
        return f"http://{self.host}"

    async def _get_json(self, path: str, params: dict | None = None) -> Any:
        try:
            async with self._session.get(self.base + path, params=params, timeout=TIMEOUT) as r:
                r.raise_for_status()
                return await r.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            raise OrbitDMDError(f"{path} : {err}") from err

    async def _post(self, path: str, fields: dict[str, Any] | None = None) -> str:
        form = aiohttp.FormData()
        # multipart obligatoire (le panneau lit les champs d'un formulaire multipart)
        form.add_field("password", self._password, content_type="text/plain")
        for key, value in (fields or {}).items():
            if value is not None and value != "":
                form.add_field(key, str(value), content_type="text/plain")
        async with self._lock:
            try:
                async with self._session.post(self.base + path, data=form, timeout=TIMEOUT) as r:
                    text = (await r.text()).strip()
            except (aiohttp.ClientError, asyncio.TimeoutError) as err:
                raise OrbitDMDError(f"{path} : {err}") from err
        if text.startswith("OK"):
            return text
        if "mot de passe" in text.lower():
            raise OrbitDMDAuthError(text)
        raise OrbitDMDError(text)

    # --- lecture ---

    async def status(self) -> dict[str, Any]:
        return await self._get_json("/api/etat")

    async def gifs(self) -> list[str]:
        """Toutes les GIF, "Categorie/nom.gif" ; categorie de notification en premier."""
        data = await self._get_json("/api/gif")
        out: list[str] = []
        for cat in data.get("categories", []):
            name = cat.get("nom")
            if not name:
                continue
            files = await self._get_json("/api/gif/liste", {"c": name})
            out.extend(f"{name}/{f['nom']}" for f in files.get("fichiers", []) if f.get("nom"))
        return out

    async def gif_data(self, gif: str) -> bytes:
        """Contenu d'une GIF "Categorie/nom.gif" (pour les apercus de la page OrbitDMD)."""
        cat, _, name = gif.partition("/")
        async with self._gif_slots:
            try:
                async with self._session.get(self.base + "/gif/voir", params={"c": cat, "f": name},
                                             timeout=TIMEOUT) as r:
                    r.raise_for_status()
                    return await r.read()
            except (aiohttp.ClientError, asyncio.TimeoutError) as err:
                raise OrbitDMDError(f"{gif} : {err}") from err

    def gif_url(self, gif: str) -> str:
        cat, _, name = gif.partition("/")
        return f"{self.base}/gif/voir?c={cat}&f={name}"

    # --- commandes ---

    async def check_password(self) -> None:
        await self._post("/api/verifier")

    async def notify(self, **fields: Any) -> str:
        """message, gif, effet, couleur, police, taille, vitesse, passages"""
        return await self._post("/api/notification", fields)

    async def command(self, action: str) -> str:
        """pause, reprendre, eteindre, allumer"""
        return await self._post("/api/commande", {"action": action})

    async def brightness(self, value: int | str) -> str:
        """0 a 100, ou "auto" (luminosite heure par heure des reglages)"""
        return await self._post("/api/luminosite", {"valeur": value})

    async def show_clock(self) -> str:
        return await self._post("/api/horloge/montrer")

    async def show_weather(self) -> str:
        return await self._post("/api/meteo/montrer")

    async def restart(self) -> str:
        return await self._post("/redemarrer")
