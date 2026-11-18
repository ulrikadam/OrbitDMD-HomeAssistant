"""Bouton "Telecharger les diagnostics" : etat du panneau et de l'integration, sans donnees privees."""
from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import OrbitDMDConfigEntry
from .const import CONF_PASSWORD

# masques : mot de passe de la page web, nom du reseau Wi-Fi, lieu de la meteo
TO_REDACT = {CONF_PASSWORD, "wifi", "meteo_lieu", "latitude", "longitude"}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: OrbitDMDConfigEntry) -> dict[str, Any]:
    coordinator = entry.runtime_data
    gifs = coordinator.gifs
    categories: dict[str, int] = {}
    for gif in gifs:
        cat = gif.split("/", 1)[0]
        categories[cat] = categories.get(cat, 0) + 1
    return {
        "entry": {"title": entry.title, "unique_id": entry.unique_id, "data": async_redact_data(dict(entry.data), TO_REDACT)},
        "panel_reachable": coordinator.last_update_success,
        "last_error": str(coordinator.last_exception) if coordinator.last_exception else None,
        "panel_status": async_redact_data(dict(coordinator.data or {}), TO_REDACT),
        "gifs": {"count": len(gifs), "categories": categories},
    }
