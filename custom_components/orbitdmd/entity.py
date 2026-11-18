"""Base des entites : un appareil par panneau."""
from __future__ import annotations

from collections.abc import Awaitable
from typing import Any

from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .api import OrbitDMDError
from .const import DOMAIN, MANUFACTURER
from .coordinator import OrbitDMDCoordinator


class OrbitDMDEntity(CoordinatorEntity[OrbitDMDCoordinator]):
    _attr_has_entity_name = True

    def __init__(self, coordinator: OrbitDMDCoordinator, key: str) -> None:
        super().__init__(coordinator)
        entry = coordinator.config_entry
        self._attr_unique_id = f"{entry.unique_id}_{key}"
        self._attr_translation_key = key
        data = coordinator.data or {}
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.unique_id)},
            name=entry.title,
            manufacturer=MANUFACTURER,
            model="Raspberry Pi 3 + HUB75",
            sw_version=data.get("version"),
            configuration_url=coordinator.api.base,
        )

    @property
    def data(self) -> dict[str, Any]:
        return self.coordinator.data or {}

    async def _run(self, call: Awaitable[Any]) -> None:
        """Commande au panneau, puis relecture rapide de l'etat."""
        try:
            await call
        except OrbitDMDError as err:
            raise HomeAssistantError(f"OrbitDMD : {err}") from err
        await self.coordinator.async_request_refresh()
