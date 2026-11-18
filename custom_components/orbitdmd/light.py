"""Le panneau comme une lumiere : allume ou eteint (page web toujours joignable), luminosite."""
from __future__ import annotations

from typing import Any

from homeassistant.components.light import ATTR_BRIGHTNESS, ColorMode, LightEntity

from .entity import OrbitDMDEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([OrbitDMDLight(entry.runtime_data, "panel")])


class OrbitDMDLight(OrbitDMDEntity, LightEntity):
    _attr_color_mode = ColorMode.BRIGHTNESS
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}
    _attr_name = None            # le nom de l'appareil

    @property
    def is_on(self) -> bool:
        return not self.data.get("ecran_eteint", False)

    @property
    def brightness(self) -> int | None:
        value = self.data.get("luminosite")
        return None if value is None else round(int(value) * 255 / 100)

    async def async_turn_on(self, **kwargs: Any) -> None:
        if ATTR_BRIGHTNESS in kwargs:
            await self._run(self.coordinator.api.brightness(max(1, round(kwargs[ATTR_BRIGHTNESS] * 100 / 255))))
        if not self.is_on:
            await self._run(self.coordinator.api.command("allumer"))

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._run(self.coordinator.api.command("eteindre"))
