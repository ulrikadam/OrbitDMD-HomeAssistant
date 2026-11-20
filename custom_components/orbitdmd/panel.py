"""Page "OrbitDMD" dans la barre laterale de Home Assistant.

Un assistant en 4 etapes cree des alertes (automatisations ordinaires de Home Assistant) :
GIF -> declencheur -> message -> enregistrer. Les GIF du panneau sont montrees animees grace
a un relais (/api/orbitdmd/gif/...) : le navigateur ne parle qu'a Home Assistant.
"""
from __future__ import annotations

import hashlib
from collections import OrderedDict
from pathlib import Path
from typing import Any

import voluptuous as vol
from aiohttp import web
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.http import KEY_HASS

from .api import OrbitDMDError
from .const import CONF_HOST, DOMAIN, NOTIFY_CATEGORY

FRONTEND = Path(__file__).parent / "frontend"
STATIC_URL = "/orbitdmd_static"
PANEL_JS = "orbitdmd-panel.js"
CACHE_MAX_BYTES = 24 * 1024 * 1024     # GIF gardees en memoire (le Pi lit sa carte SD lentement)


class FrontendView(HomeAssistantView):
    """Fichiers de la page, avec "Cache-Control: no-cache" : le navigateur verifie a chaque
    ouverture s'ils ont change (reponse 304 tres legere sinon). Une mise a jour des fichiers
    est donc vue sans redemarrer Home Assistant (l'empreinte ?v= ne change qu'au demarrage)."""

    url = STATIC_URL + "/{filename}"
    name = "orbitdmd:frontend"
    requires_auth = False      # comme les fichiers statiques des autres integrations

    async def get(self, request: web.Request, filename: str) -> web.StreamResponse:
        if filename not in FRONTEND_FILES:
            return web.Response(status=404)
        return web.FileResponse(FRONTEND / filename, headers={"Cache-Control": "no-cache"})


# orbitdmd-pixel.ttf : la police "Pixel" du panneau (5x7), pour l'apercu des messages
FRONTEND_FILES = ("orbitdmd-panel.js", "orbitdmd-i18n.js", "orbitdmd-pixel.ttf")


async def async_setup_panel(hass: HomeAssistant) -> None:
    hass.http.register_view(FrontendView())
    # l'empreinte du fichier force le navigateur a recharger la page apres une mise a jour
    # (la page charge aussi orbitdmd-i18n.js avec la meme empreinte)
    def _digest() -> str:
        h = hashlib.md5()
        for f in sorted(FRONTEND.glob("*.js")):
            h.update(f.read_bytes())
        return h.hexdigest()[:8]

    digest = await hass.async_add_executor_job(_digest)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=DOMAIN,
        webcomponent_name="orbitdmd-panel",
        module_url=f"{STATIC_URL}/{PANEL_JS}?v={digest}",
        sidebar_title="OrbitDMD",
        sidebar_icon="mdi:dots-grid",
        require_admin=True,
    )
    hass.http.register_view(GifView())
    hass.http.register_view(FontView())
    websocket_api.async_register_command(hass, ws_panels)


@websocket_api.websocket_command({vol.Required("type"): "orbitdmd/panels"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_panels(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Panneaux relies, avec leur appareil et la liste de leurs GIF."""
    registry = dr.async_get(hass)
    panels = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.disabled_by:
            continue
        devices = dr.async_entries_for_config_entry(registry, entry.entry_id)
        panel = {
            "entry_id": entry.entry_id,
            "title": entry.title,
            "url": f"http://{entry.data.get(CONF_HOST, '')}",   # page web du panneau ("Gerer le panneau")
            "online": False,                       # faux : bandeau "panneau injoignable"
            "device_id": devices[0].id if devices else None,
            "gifs": [],
            "fonts": [],
        }
        if entry.state is ConfigEntryState.LOADED:
            coordinator = entry.runtime_data
            if not coordinator.gifs and coordinator.last_update_success:
                await coordinator.async_refresh_gifs()
            panel.update(url=coordinator.api.base, online=coordinator.last_update_success, gifs=coordinator.gifs,
                         fonts=coordinator.fonts)
        # (non charge : panneau eteint au demarrage de Home Assistant, il se reconnectera tout seul)
        panels.append(panel)
    connection.send_result(msg["id"], {"panels": panels, "notify_category": NOTIFY_CATEGORY})


class GifView(HomeAssistantView):
    """Relais des GIF du panneau (seulement celles de sa liste : pas d'autre chemin possible)."""

    url = "/api/orbitdmd/gif/{entry_id}/{category}/{name}"
    name = "api:orbitdmd:gif"
    requires_auth = True

    def __init__(self) -> None:
        self._cache: OrderedDict[tuple[str, str], bytes] = OrderedDict()
        self._size = 0

    async def get(self, request: web.Request, entry_id: str, category: str, name: str) -> web.Response:
        hass = request.app[KEY_HASS]
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
            return web.Response(status=404)
        gif = f"{category}/{name}"
        if gif not in entry.runtime_data.gifs:
            return web.Response(status=404)
        key = (entry_id, gif)
        data = self._cache.get(key)
        if data is None:
            try:
                data = await entry.runtime_data.api.gif_data(gif)
            except OrbitDMDError:
                return web.Response(status=502)
            self._cache[key] = data
            self._size += len(data)
            while self._size > CACHE_MAX_BYTES and self._cache:
                _, old = self._cache.popitem(last=False)
                self._size -= len(old)
        else:
            self._cache.move_to_end(key)
        return web.Response(body=data, content_type="image/gif",
                            headers={"Cache-Control": "private, max-age=86400"})


class FontView(HomeAssistantView):
    """Relais des polices du panneau, pour l'apercu du texte (seulement celles de sa liste)."""

    url = "/api/orbitdmd/font/{entry_id}/{name}"
    name = "api:orbitdmd:font"
    requires_auth = True

    def __init__(self) -> None:
        self._cache: dict[tuple[str, str], bytes] = {}     # une quinzaine de polices de 20 a 100 Ko

    async def get(self, request: web.Request, entry_id: str, name: str) -> web.Response:
        hass = request.app[KEY_HASS]
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
            return web.Response(status=404)
        if name not in entry.runtime_data.fonts:
            return web.Response(status=404)
        key = (entry_id, name)
        data = self._cache.get(key)
        if data is None:
            try:
                data = await entry.runtime_data.api.font_data(name)
            except OrbitDMDError:
                return web.Response(status=502)      # panneau injoignable, ou plus ancien que 1.7.0
            if len(self._cache) < 64:
                self._cache[key] = data
        return web.Response(body=data, content_type="font/ttf",
                            headers={"Cache-Control": "private, max-age=86400"})
