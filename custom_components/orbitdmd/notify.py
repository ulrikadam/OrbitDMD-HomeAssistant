"""Entite de notification : notify.send_message affiche le texte sur le panneau (style par defaut)."""
from __future__ import annotations

from homeassistant.components.notify import NotifyEntity

from . import send_notification
from .entity import OrbitDMDEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([OrbitDMDNotify(entry.runtime_data, "message")])


class OrbitDMDNotify(OrbitDMDEntity, NotifyEntity):
    _attr_icon = "mdi:message-text"

    async def async_send_message(self, message: str, title: str | None = None) -> None:
        await send_notification(self.coordinator, {"message": message})
