"""OrbitDMD : panneaux LED HUB75 sur Raspberry Pi (https://github.com/ulrikadam/OrbitDMD).

L'integration parle directement a la page web du panneau (pas besoin de MQTT).
"""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import OrbitDMDApi, OrbitDMDAuthError, OrbitDMDError
from homeassistant.helpers import issue_registry as ir

from .const import (ATTR_BLINK, ATTR_COLOR, ATTR_DEVICE, ATTR_EFFECT, ATTR_FONT, ATTR_GIF, ATTR_MESSAGE, ATTR_PASSES,
                    ATTR_SIZE, ATTR_SPEED, CONF_HOST, CONF_PANEL_ID, CONF_PASSWORD, DOMAIN, MIN_PANEL_VERSION,
                    RELEASES_URL, SERVICE_NOTIFY, panel_id, panel_too_old)
from .coordinator import OrbitDMDCoordinator
from .panel import async_setup_panel

PLATFORMS = [Platform.BUTTON, Platform.LIGHT, Platform.NOTIFY, Platform.SENSOR, Platform.SWITCH]

type OrbitDMDConfigEntry = ConfigEntry[OrbitDMDCoordinator]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

NOTIFY_SCHEMA = vol.Schema({
    vol.Optional(ATTR_DEVICE): vol.Any(cv.string, [cv.string]),
    vol.Optional(ATTR_MESSAGE, default=""): cv.string,
    vol.Optional(ATTR_GIF): cv.string,
    vol.Optional(ATTR_EFFECT): cv.string,
    vol.Optional(ATTR_COLOR): cv.string,
    vol.Optional(ATTR_SPEED): vol.All(vol.Coerce(int), vol.Range(min=1, max=10)),
    vol.Optional(ATTR_PASSES): vol.All(vol.Coerce(int), vol.Range(min=1, max=10)),
    vol.Optional(ATTR_FONT): cv.string,
    vol.Optional(ATTR_SIZE): vol.All(vol.Coerce(int), vol.Range(min=0, max=48)),
    vol.Optional(ATTR_BLINK): cv.boolean,
})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    async def notify(call: ServiceCall) -> None:
        devices = call.data.get(ATTR_DEVICE)
        coordinators = coordinators_for(hass, [devices] if isinstance(devices, str) else devices)
        if not coordinators:
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="no_panel")
        for coordinator in coordinators:
            await send_notification(coordinator, call.data)

    hass.services.async_register(DOMAIN, SERVICE_NOTIFY, notify, schema=NOTIFY_SCHEMA)
    await async_setup_panel(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: OrbitDMDConfigEntry) -> bool:
    api = OrbitDMDApi(async_get_clientsession(hass), entry.data[CONF_HOST], entry.data[CONF_PASSWORD])
    coordinator = OrbitDMDCoordinator(hass, api)
    await coordinator.async_config_entry_first_refresh()
    try:
        await api.check_password()
    except OrbitDMDAuthError as err:
        raise ConfigEntryAuthFailed(str(err)) from err
    except OrbitDMDError as err:
        raise ConfigEntryNotReady(str(err)) from err
    entry.runtime_data = coordinator
    status = coordinator.data or {}
    # panneau relie avant la 1.6.0 (reconnu par son nom) : on memorise son numero de serie
    if status.get("id") and entry.data.get(CONF_PANEL_ID) != panel_id(status):
        hass.config_entries.async_update_entry(entry, data={**entry.data, CONF_PANEL_ID: panel_id(status)})
    check_panel_version(hass, entry, status.get("version"))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


def check_panel_version(hass: HomeAssistant, entry: ConfigEntry, version: str | None) -> None:
    """Programme du panneau trop ancien : message dans Parametres -> Reparations (retire ensuite)."""
    issue = f"panel_too_old_{entry.entry_id}"
    if version and panel_too_old(version):
        ir.async_create_issue(
            hass, DOMAIN, issue, is_fixable=False, severity=ir.IssueSeverity.WARNING,
            translation_key="panel_too_old", learn_more_url=RELEASES_URL,
            translation_placeholders={"name": entry.title, "version": version, "minimum": MIN_PANEL_VERSION})
    else:
        ir.async_delete_issue(hass, DOMAIN, issue)


async def async_unload_entry(hass: HomeAssistant, entry: OrbitDMDConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


def coordinators_for(hass: HomeAssistant, device_ids: list[str] | None) -> list[OrbitDMDCoordinator]:
    """Panneaux vises : ceux des appareils indiques, sinon tous."""
    entries = [e for e in hass.config_entries.async_loaded_entries(DOMAIN)]
    if not device_ids:
        return [e.runtime_data for e in entries]
    registry = dr.async_get(hass)
    wanted: set[str] = set()
    for device_id in device_ids:
        device = registry.async_get(device_id)
        if device:
            # Home Assistant 2026 : un appareil appartient a une seule integration (config_entry_id) ;
            # les versions plus anciennes n'ont que la liste config_entries
            entry_id = getattr(device, "config_entry_id", None)
            wanted.update([entry_id] if entry_id else device.config_entries)
    return [e.runtime_data for e in entries if e.entry_id in wanted]


async def send_notification(coordinator: OrbitDMDCoordinator, data: dict[str, Any]) -> None:
    fields = {
        "message": data.get(ATTR_MESSAGE, ""),
        "gif": data.get(ATTR_GIF),
        "effet": data.get(ATTR_EFFECT),
        "couleur": data.get(ATTR_COLOR),
        "vitesse": data.get(ATTR_SPEED),
        "passages": data.get(ATTR_PASSES),
        "police": data.get(ATTR_FONT),
        "taille": data.get(ATTR_SIZE),
        "clignote": "1" if data.get(ATTR_BLINK) else None,
    }
    if not fields["message"] and not fields["gif"]:
        raise HomeAssistantError(translation_domain=DOMAIN, translation_key="need_content")
    version = (coordinator.data or {}).get("version")
    if version and panel_too_old(version):
        name = coordinator.config_entry.title if coordinator.config_entry else "OrbitDMD"
        raise HomeAssistantError(translation_domain=DOMAIN, translation_key="panel_too_old",
                                 translation_placeholders={"name": name, "version": version, "minimum": MIN_PANEL_VERSION})
    try:
        await coordinator.api.notify(**fields)
    except OrbitDMDError as err:
        raise HomeAssistantError(translation_domain=DOMAIN, translation_key="panel_error",
                                 translation_placeholders={"error": str(err)}) from err
