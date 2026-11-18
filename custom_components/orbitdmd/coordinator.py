"""Lecture reguliere de l'etat du panneau et de la liste des GIF."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import OrbitDMDApi, OrbitDMDError
from .const import DOMAIN, GIF_REFRESH, NOTIFY_CATEGORY, SCAN_INTERVAL

_LOGGER = logging.getLogger(__name__)


class OrbitDMDCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    def __init__(self, hass: HomeAssistant, api: OrbitDMDApi) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=SCAN_INTERVAL)
        self.api = api
        self.gifs: list[str] = []
        self._gifs_at: datetime | None = None
        self._version: str | None = None

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            data = await self.api.status()
        except OrbitDMDError as err:
            raise UpdateFailed(str(err)) from err
        version = data.get("version")
        if version != self._version and self.config_entry is not None:
            # programme du panneau mis a jour : l'avertissement "trop ancien" apparait ou disparait
            from . import check_panel_version
            check_panel_version(self.hass, self.config_entry, version)
            self._version = version
        now = dt_util.utcnow()
        if self._gifs_at is None or now - self._gifs_at > GIF_REFRESH:
            await self.async_refresh_gifs()
        return data

    async def async_refresh_gifs(self) -> None:
        try:
            gifs = await self.api.gifs()
        except OrbitDMDError as err:
            _LOGGER.debug("liste des GIF : %s", err)
            return
        notify = NOTIFY_CATEGORY.lower() + "/"
        self.gifs = sorted(gifs, key=lambda g: (not g.lower().startswith(notify), g.lower()))
        self._gifs_at = dt_util.utcnow()
