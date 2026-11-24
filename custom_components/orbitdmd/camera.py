"""Camera "Ecran en direct" : ce que montre le panneau, dans les tableaux de bord et l'application.

Pendant une GIF : la GIF elle-meme, animee et agrandie (convertie une seule fois par GIF).
Sinon (heure, meteo, message, pause...) : une copie de l'ecran du panneau, agrandie.
"""
from __future__ import annotations

import logging

from homeassistant.components.camera import Camera
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .api import OrbitDMDError
from .coordinator import OrbitDMDCoordinator
from .entity import OrbitDMDEntity
from .rendu import led_gif, led_png

_LOGGER = logging.getLogger(__name__)
GIF_PREFIX = "SD:/gif/"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([OrbitDMDLive(entry.runtime_data)])


class OrbitDMDLive(OrbitDMDEntity, Camera):
    _attr_icon = "mdi:television-play"

    def __init__(self, coordinator: OrbitDMDCoordinator) -> None:
        OrbitDMDEntity.__init__(self, coordinator, "live")
        Camera.__init__(self)
        self.content_type = "image/png"
        self._gif: tuple[str, bytes] | None = None     # derniere GIF convertie (chemin, image)

    @property
    def frame_interval(self) -> float:
        # flux de la fenetre de l'entite : une image par seconde suffit (le panneau repond a une demande a la fois)
        return 1.0

    async def async_camera_image(self, width: int | None = None, height: int | None = None) -> bytes | None:
        api = self.coordinator.api
        try:
            kind, data = await api.screen()
            if kind == "gif":
                path = data.decode("utf-8", "replace").strip()
                if not self._gif or self._gif[0] != path:
                    gif = path.removeprefix(GIF_PREFIX)           # "Categorie/nom.gif"
                    raw = await api.gif_data(gif)
                    self._gif = (path, await self.hass.async_add_executor_job(led_gif, raw))
                self.content_type = "image/gif"
                return self._gif[1]
            image = await self.hass.async_add_executor_job(led_png, data)
            self.content_type = "image/png"
            return image
        except OrbitDMDError as err:
            _LOGGER.debug("ecran du panneau : %s", err)
            return None
        except Exception as err:  # image illisible : pas d'image plutot qu'une erreur dans le journal
            _LOGGER.debug("ecran du panneau, image illisible : %s", err)
            return None
