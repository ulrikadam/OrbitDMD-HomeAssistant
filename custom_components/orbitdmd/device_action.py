"""Action d'appareil "Afficher une notification" dans l'editeur d'automatisations.

La liste des GIF est lue sur le panneau (categorie Domotique en premier) : on la choisit
dans une liste deroulante, sans YAML. Le texte accepte les modeles ({{ states('sensor.x') }}).
"""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.const import CONF_DEVICE_ID, CONF_DOMAIN, CONF_TYPE
from homeassistant.core import Context, HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.template import Template
from homeassistant.helpers.translation import async_get_translations

from . import coordinators_for, send_notification
from .const import (ATTR_BLINK, ATTR_COLOR, ATTR_ICON, ICON_CATEGORY, ATTR_EFFECT, ATTR_GIF, ATTR_MESSAGE, ATTR_PASSES, ATTR_SPEED, COLORS, DOMAIN,
                    EFFECTS)

ACTION_NOTIFY = "notify"

ACTION_SCHEMA = cv.DEVICE_ACTION_BASE_SCHEMA.extend({
    vol.Required(CONF_TYPE): vol.In([ACTION_NOTIFY]),
    vol.Optional(ATTR_MESSAGE, default=""): cv.string,
    vol.Optional(ATTR_GIF): cv.string,
    vol.Optional(ATTR_EFFECT): vol.In(EFFECTS),
    vol.Optional(ATTR_COLOR): cv.string,
    vol.Optional(ATTR_SPEED): vol.All(vol.Coerce(int), vol.Range(min=1, max=10)),
    vol.Optional(ATTR_PASSES): vol.All(vol.Coerce(int), vol.Range(min=1, max=10)),
    vol.Optional(ATTR_BLINK): cv.boolean,
    vol.Optional(ATTR_ICON): cv.string,
})


async def async_get_actions(hass: HomeAssistant, device_id: str) -> list[dict[str, Any]]:
    return [{CONF_DEVICE_ID: device_id, CONF_DOMAIN: DOMAIN, CONF_TYPE: ACTION_NOTIFY}]


async def async_get_action_capabilities(hass: HomeAssistant, config: dict[str, Any]) -> dict[str, vol.Schema]:
    gifs: list[str] = []
    for coordinator in coordinators_for(hass, [config[CONF_DEVICE_ID]]):
        if not coordinator.gifs:
            await coordinator.async_refresh_gifs()
        gifs = coordinator.gifs
    fields: dict[Any, Any] = {vol.Optional(ATTR_MESSAGE): str}
    fields[vol.Optional(ATTR_GIF)] = vol.In(gifs) if gifs else str
    # Libelles lisibles ("Defile a gauche" plutot que "defile"), pris dans translations/<langue>.json.
    labels = await async_get_translations(hass, hass.config.language, "selector", [DOMAIN])

    def options(key: str, values: list[str]) -> dict[str, str]:
        prefix = f"component.{DOMAIN}.selector.{key}.options."
        return {v: labels.get(prefix + v, v) for v in values}

    fields[vol.Optional(ATTR_EFFECT)] = vol.In(options("effect", EFFECTS))
    fields[vol.Optional(ATTR_COLOR)] = vol.In(options("color", COLORS))
    fields[vol.Optional(ATTR_SPEED)] = vol.All(vol.Coerce(int), vol.Range(min=1, max=10))
    fields[vol.Optional(ATTR_PASSES)] = vol.All(vol.Coerce(int), vol.Range(min=1, max=10))
    fields[vol.Optional(ATTR_BLINK)] = bool
    icons = [g for g in gifs if g.split("/")[0] == ICON_CATEGORY]
    if icons:      # icone a gauche du texte (categorie Icones du panneau)
        fields[vol.Optional(ATTR_ICON)] = vol.In(icons)
    return {"extra_fields": vol.Schema(fields)}


async def async_call_action_from_config(hass: HomeAssistant, config: dict[str, Any], variables: dict[str, Any],
                                        context: Context | None) -> None:
    data = dict(config)
    message = data.get(ATTR_MESSAGE) or ""
    if "{" in message:
        data[ATTR_MESSAGE] = str(Template(message, hass).async_render(variables, parse_result=False))
    for coordinator in coordinators_for(hass, [config[CONF_DEVICE_ID]]):
        await send_notification(coordinator, data)
