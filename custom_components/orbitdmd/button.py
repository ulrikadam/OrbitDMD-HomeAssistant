"""Boutons : afficher l'heure, afficher la meteo (15 s), redemarrer."""
from __future__ import annotations

from homeassistant.components.button import ButtonDeviceClass, ButtonEntity
from homeassistant.const import EntityCategory

from .entity import OrbitDMDEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([OrbitDMDButton(c, "show_clock"), OrbitDMDButton(c, "show_weather"), OrbitDMDButton(c, "restart")])


class OrbitDMDButton(OrbitDMDEntity, ButtonEntity):
    def __init__(self, coordinator, key: str) -> None:
        super().__init__(coordinator, key)
        self._key = key
        if key == "restart":
            self._attr_device_class = ButtonDeviceClass.RESTART
            self._attr_entity_category = EntityCategory.CONFIG
        else:
            self._attr_icon = "mdi:clock-outline" if key == "show_clock" else "mdi:weather-partly-cloudy"

    async def async_press(self) -> None:
        api = self.coordinator.api
        await self._run({"show_clock": api.show_clock, "show_weather": api.show_weather, "restart": api.restart}[self._key]())
