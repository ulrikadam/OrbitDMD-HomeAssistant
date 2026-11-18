"""Interrupteurs : pause (image figee), luminosite heure par heure des reglages."""
from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.const import EntityCategory

from .entity import OrbitDMDEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([PauseSwitch(c, "pause"), HourlyBrightnessSwitch(c, "hourly_brightness")])


class PauseSwitch(OrbitDMDEntity, SwitchEntity):
    _attr_icon = "mdi:pause"

    @property
    def is_on(self) -> bool:
        return bool(self.data.get("pause", False))

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._run(self.coordinator.api.command("pause"))

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._run(self.coordinator.api.command("reprendre"))


class HourlyBrightnessSwitch(OrbitDMDEntity, SwitchEntity):
    """Allume : la luminosite suit les reglages heure par heure ; regler la luminosite l'eteint."""
    _attr_icon = "mdi:brightness-auto"
    _attr_entity_category = EntityCategory.CONFIG

    @property
    def is_on(self) -> bool:
        return int(self.data.get("luminosite_forcee", -1)) < 0

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._run(self.coordinator.api.brightness("auto"))

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._run(self.coordinator.api.brightness(int(self.data.get("luminosite", 60))))
