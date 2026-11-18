"""Installation guidee : adresse du panneau et mot de passe de sa page web."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.data_entry_flow import AbortFlow
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.service_info.zeroconf import ZeroconfServiceInfo

from .api import OrbitDMDApi, OrbitDMDAuthError, OrbitDMDError
from .const import CONF_HOST, CONF_PANEL_ID, CONF_PASSWORD, DOMAIN, panel_id


class OrbitDMDConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def _check_known(self, host: str, pid: str) -> None:
        """Un panneau deja relie n'est jamais ajoute deux fois.

        Identifiant : numero de serie du Raspberry Pi (panneau 1.6.0+). Les panneaux relies avant
        (identifies par leur nom) sont reconnus par le numero de serie memorise ensuite, ou par leur adresse.
        """
        for entry in self._async_current_entries(include_ignore=False):
            known = entry.data.get(CONF_PANEL_ID)
            if entry.unique_id != pid and (known == pid or (not known and entry.data.get(CONF_HOST) == host)):
                self.hass.config_entries.async_update_entry(entry, data={**entry.data, CONF_HOST: host})
                raise AbortFlow("already_configured")
        await self.async_set_unique_id(pid)
        self._abort_if_unique_id_configured(updates={CONF_HOST: host})

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            api = OrbitDMDApi(async_get_clientsession(self.hass), user_input[CONF_HOST], user_input[CONF_PASSWORD])
            try:
                status = await api.status()
                await api.check_password()
            except OrbitDMDAuthError:
                errors["base"] = "invalid_auth"
            except OrbitDMDError:
                errors["base"] = "cannot_connect"
            else:
                name = status.get("nom") or "OrbitDMD"
                pid = panel_id(status)
                await self._check_known(api.host, pid)
                return self.async_create_entry(title=name, data={CONF_HOST: api.host, CONF_PASSWORD: user_input[CONF_PASSWORD],
                                                                 CONF_PANEL_ID: pid})

        schema = vol.Schema({
            vol.Required(CONF_HOST, default=(user_input or {}).get(CONF_HOST, "orbitdmd.local")): str,
            vol.Required(CONF_PASSWORD): str,
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    # --- panneau trouve sur le reseau (service _orbitdmd._tcp, ou _http._tcp nomme "OrbitDMD...") ---

    async def async_step_zeroconf(self, discovery_info: ZeroconfServiceInfo) -> ConfigFlowResult:
        host = str(discovery_info.ip_address)
        api = OrbitDMDApi(async_get_clientsession(self.hass), host, "")
        try:
            status = await api.status()
        except OrbitDMDError:
            return self.async_abort(reason="cannot_connect")
        if "version" not in status or "nom" not in status:
            return self.async_abort(reason="not_orbitdmd")      # autre appareil avec un nom proche
        name = status.get("nom") or "OrbitDMD"
        self._pid = panel_id(status)
        # deja relie : on met seulement l'adresse a jour (IP changee)
        await self._check_known(host, self._pid)
        self._host, self._name = host, name
        self.context["title_placeholders"] = {"name": name}
        return await self.async_step_zeroconf_confirm()

    async def async_step_zeroconf_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            api = OrbitDMDApi(async_get_clientsession(self.hass), self._host, user_input[CONF_PASSWORD])
            try:
                await api.check_password()
            except OrbitDMDAuthError:
                errors["base"] = "invalid_auth"
            except OrbitDMDError:
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(title=self._name,
                                               data={CONF_HOST: self._host, CONF_PASSWORD: user_input[CONF_PASSWORD],
                                                     CONF_PANEL_ID: self._pid})
        return self.async_show_form(step_id="zeroconf_confirm", data_schema=vol.Schema({vol.Required(CONF_PASSWORD): str}),
                                    description_placeholders={"name": self._name, "host": self._host}, errors=errors)

    async def async_step_reauth(self, entry_data: dict[str, Any]) -> ConfigFlowResult:
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entry = self._get_reauth_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            api = OrbitDMDApi(async_get_clientsession(self.hass), entry.data[CONF_HOST], user_input[CONF_PASSWORD])
            try:
                await api.check_password()
            except OrbitDMDAuthError:
                errors["base"] = "invalid_auth"
            except OrbitDMDError:
                errors["base"] = "cannot_connect"
            else:
                return self.async_update_reload_and_abort(entry, data_updates={CONF_PASSWORD: user_input[CONF_PASSWORD]})
        return self.async_show_form(step_id="reauth_confirm", data_schema=vol.Schema({vol.Required(CONF_PASSWORD): str}),
                                    errors=errors)
