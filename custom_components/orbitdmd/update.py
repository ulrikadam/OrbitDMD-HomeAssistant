"""Mise a jour "Programme du panneau" : la derniere version publiee sur GitHub, installable en un clic.

La version publiee (pas les versions de test) est relue toutes les 6 heures, une fois pour tous les
panneaux. "Installer" telecharge son kernel8.img et l'envoie au panneau, qui l'ecrit a part
(kernel8.new), garde l'ancien (kernel8.bak) et redemarre avec le nouveau programme.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import aiohttp
from homeassistant.components.update import UpdateDeviceClass, UpdateEntity, UpdateEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .api import OrbitDMDError
from .const import DOMAIN, version_tuple
from .coordinator import OrbitDMDCoordinator
from .entity import OrbitDMDEntity

_LOGGER = logging.getLogger(__name__)
LATEST_URL = "https://api.github.com/repos/ulrikadam/OrbitDMD/releases/latest"
CHECK_EVERY = timedelta(hours=6)
KERNEL = "kernel8.img"
MIN_KERNEL = 64 * 1024              # comme le panneau (MIN_KERNEL_SIZE)
MAX_KERNEL = 32 * 1024 * 1024


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([OrbitDMDProgram(entry.runtime_data)])


async def latest_release(hass: HomeAssistant, force: bool = False) -> dict[str, Any] | None:
    """Derniere version publiee (memorisee 6 heures) : version, adresse, notes, fichier kernel8.img."""
    cache = hass.data.setdefault(DOMAIN, {}).setdefault("release", {})
    now = dt_util.utcnow()
    if not force and cache.get("at") and now - cache["at"] < CHECK_EVERY:
        return cache.get("data")
    session = async_get_clientsession(hass)
    try:
        async with session.get(LATEST_URL, headers={"Accept": "application/vnd.github+json"},
                               timeout=aiohttp.ClientTimeout(total=20)) as r:
            r.raise_for_status()
            rel = await r.json()
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        _LOGGER.debug("derniere version du panneau : %s", err)
        cache["at"] = now - CHECK_EVERY + timedelta(minutes=30)      # nouvel essai dans 30 minutes
        return cache.get("data")
    asset = next((a for a in rel.get("assets", []) if a.get("name") == KERNEL), None)
    data = {
        "version": str(rel.get("tag_name") or "").lstrip("vV"),
        "url": rel.get("html_url"),
        "notes": rel.get("body") or "",
        "kernel": asset.get("browser_download_url") if asset else None,
        "size": asset.get("size") if asset else None,
    }
    cache.update(at=now, data=data)
    return data


class OrbitDMDProgram(OrbitDMDEntity, UpdateEntity):
    _attr_device_class = UpdateDeviceClass.FIRMWARE
    _attr_supported_features = UpdateEntityFeature.INSTALL | UpdateEntityFeature.RELEASE_NOTES | UpdateEntityFeature.PROGRESS
    _attr_title = "OrbitDMD"

    def __init__(self, coordinator: OrbitDMDCoordinator) -> None:
        super().__init__(coordinator, "program")
        self._release: dict[str, Any] | None = None
        self._installing = False

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(async_track_time_interval(self.hass, self._check, CHECK_EVERY))
        await self._check()

    async def _check(self, _now: Any = None) -> None:
        self._release = await latest_release(self.hass)
        self.async_write_ha_state()

    @property
    def installed_version(self) -> str | None:
        return self.data.get("version")

    @property
    def latest_version(self) -> str | None:
        installed = self.installed_version
        latest = (self._release or {}).get("version")
        # version inconnue, ou panneau deja plus recent (version de test) : rien a proposer
        if not latest or (installed and version_tuple(latest) <= version_tuple(installed)):
            return installed
        return latest

    @property
    def release_url(self) -> str | None:
        return (self._release or {}).get("url")

    @property
    def in_progress(self) -> bool:
        return self._installing

    async def async_release_notes(self) -> str | None:
        return (self._release or {}).get("notes")

    async def async_install(self, version: str | None, backup: bool, **kwargs: Any) -> None:
        release = await latest_release(self.hass, force=True) or {}
        url = release.get("kernel")
        if not url:
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="update_failed",
                                     translation_placeholders={"error": f"{KERNEL} ?"})
        self._installing = True
        self.async_write_ha_state()
        try:
            session = async_get_clientsession(self.hass)
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=300)) as r:
                    r.raise_for_status()
                    kernel = await r.read()
            except (aiohttp.ClientError, TimeoutError) as err:
                raise HomeAssistantError(translation_domain=DOMAIN, translation_key="update_failed",
                                         translation_placeholders={"error": str(err)}) from err
            if not MIN_KERNEL <= len(kernel) <= MAX_KERNEL or (release.get("size") and len(kernel) != release["size"]):
                raise HomeAssistantError(translation_domain=DOMAIN, translation_key="update_failed",
                                         translation_placeholders={"error": f"{KERNEL} : {len(kernel)} octets"})
            try:
                await self.coordinator.api.install_program(kernel)
            except OrbitDMDError as err:
                raise HomeAssistantError(translation_domain=DOMAIN, translation_key="update_failed",
                                         translation_placeholders={"error": str(err)}) from err
        finally:
            self._installing = False
            self.async_write_ha_state()
        # le panneau redemarre : la nouvelle version apparait des qu'il repond de nouveau
        await self.coordinator.async_request_refresh()
