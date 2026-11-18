"""Capteurs : GIF affichee, ecran, temperature du processeur, adresse IP, version."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory, UnitOfTemperature

from .entity import OrbitDMDEntity

SCREENS = ["gif", "heure", "date", "meteo", "message", "texte", "compte", "demarrage", "mire"]


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([GifSensor(c, "gif"), ScreenSensor(c, "screen"), TemperatureSensor(c, "temperature"),
                        DiagnosticSensor(c, "ip", "ip"), DiagnosticSensor(c, "version", "version")])


class GifSensor(OrbitDMDEntity, SensorEntity):
    _attr_icon = "mdi:file-gif-box"

    @property
    def native_value(self) -> str | None:
        path = self.data.get("gif") or ""
        name = path.rsplit("/", 1)[-1]
        return name[:-4] if name.lower().endswith(".gif") else (name or None)

    @property
    def extra_state_attributes(self) -> dict:
        return {"path": self.data.get("gif")}


class ScreenSensor(OrbitDMDEntity, SensorEntity):
    _attr_icon = "mdi:monitor"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = SCREENS

    @property
    def native_value(self) -> str | None:
        value = self.data.get("ecran")
        return value if value in SCREENS else None


class TemperatureSensor(OrbitDMDEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> int | None:
        return self.data.get("temperature_c")


class DiagnosticSensor(OrbitDMDEntity, SensorEntity):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, coordinator, key: str, field: str) -> None:
        super().__init__(coordinator, key)
        self._field = field
        self._attr_icon = "mdi:ip-network" if key == "ip" else "mdi:information-outline"

    @property
    def native_value(self) -> str | None:
        return self.data.get(self._field)
