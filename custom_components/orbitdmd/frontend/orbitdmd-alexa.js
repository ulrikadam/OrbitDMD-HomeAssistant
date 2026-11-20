// Alertes Alexa de la page OrbitDMD : minuteurs, rappels, alarmes et musique des appareils Alexa,
// lus par l'integration communautaire Alexa Media Player (alexa_media).
// Chaque evenement choisi devient une automatisation ordinaire (id "orbitdmd_alexa_<evenement>")
// qui couvre tous les appareils coches ; ses reglages sont gardes dans variables.orbitdmd.

// evenements, dans l'ordre du menu ; "on" : actif la premiere fois
export const EVENTS = [
  { key: "timer_start", sensor: "timer", tokens: ["name", "duration"], on: true, icon: "enceinte_allumee", color: "turquoise", effect: "fondu" },
  { key: "timer_done", sensor: "timer", tokens: ["name"], on: true, icon: "cuisson_terminee", color: "orange", effect: "fondu", prio: true },
  { key: "timer_cancel", sensor: "timer", tokens: ["name"], on: false, icon: "enceinte_eteinte", color: "blanc", effect: "fondu" },
  { key: "reminder", sensor: "reminder", tokens: ["text"], on: true, icon: "courrier_recu", color: "jaune", effect: "defile" },
  { key: "alarm", sensor: "alarm", tokens: ["time"], on: false, icon: "mode_nuit_active", color: "ambre", effect: "fondu" },
  { key: "music", sensor: "media", tokens: ["title", "artist"], on: false, icon: "enceinte_allumee", color: "violet", effect: "defile" },
];
export const TOKENS = ["name", "duration", "text", "time", "title", "artist"];
export const ID_PREFIX = "orbitdmd_alexa_";
const SUFFIX = { "_next Timer": "timer", "_next Alarm": "alarm", "_next Reminder": "reminder" };

// appareils Alexa : ceux qui ont un capteur "prochain minuteur" (identifiant interne "<serie>_next Timer",
// le meme dans toutes les langues) ; Echo coches d'office, les autres (Sonos, application, ecouteurs) proposes
export async function alexaDevices(hass) {
  const [ents, devs, areas] = await Promise.all([
    hass.callWS({ type: "config/entity_registry/list" }),
    hass.callWS({ type: "config/device_registry/list" }),
    hass.callWS({ type: "config/area_registry/list" }).catch(() => []),
  ]);
  const byDevice = new Map();
  for (const e of ents) {
    if (e.platform !== "alexa_media" || e.disabled_by || !e.device_id) continue;
    let kind = null;
    for (const [suffix, k] of Object.entries(SUFFIX)) if (String(e.unique_id || "").endsWith(suffix)) kind = k;
    if (!kind && e.entity_id.startsWith("media_player.")) kind = "media";
    if (!kind) continue;
    if (!byDevice.has(e.device_id)) byDevice.set(e.device_id, {});
    byDevice.get(e.device_id)[kind] = e.entity_id;
  }
  const list = [];
  for (const [id, sensors] of byDevice) {
    if (!sensors.timer) continue;
    const d = devs.find((x) => x.id === id) || {};
    const area = areas.find((a) => a.area_id === d.area_id);
    list.push({ id, name: d.name_by_user || d.name || sensors.timer, model: d.model || "", area: area ? area.name : "",
      echo: /^echo/i.test(d.model || ""), ...sensors });
  }
  return list.sort((a, b) => (b.echo - a.echo) || a.name.localeCompare(b.name));
}

export const isAlexa = (cfg) => !!(cfg && cfg.variables && cfg.variables.orbitdmd && cfg.variables.orbitdmd.kind === "alexa");

// reglages de depart : evenements par defaut, textes de la langue, Echo coches
export function defaultSettings(t, devices, panelDevice, icons) {
  const has = (g) => icons.includes(g);
  const events = {};
  for (const ev of EVENTS) {
    const icon = `Icones/${ev.icon}.gif`;
    events[ev.key] = { on: ev.on, text: t[`ax_text_${ev.key}`], icon: has(icon) ? icon : (icons[0] || ""),
      color: ev.color, effect: ev.effect, prio: !!ev.prio };
  }
  return { device: panelDevice, echos: devices.filter((d) => d.echo).map((d) => d.id), room: false,
    quiet: false, quietFrom: "23:00", quietTo: "07:00", events };
}

// reglages relus dans les automatisations Alexa existantes (un evenement absent = desactive)
export function settingsFrom(configs, t, devices, panelDevice, icons) {
  const found = configs.filter(isAlexa);
  const s = defaultSettings(t, devices, panelDevice, icons);
  if (!found.length) return s;
  const m0 = found[0].variables.orbitdmd;
  const notify0 = findNotify(found[0].actions) || {};
  Object.assign(s, { echos: Array.isArray(m0.echos) ? m0.echos.slice() : s.echos, room: !!m0.room, quiet: !!m0.quiet,
    quietFrom: m0.quiet_from || s.quietFrom, quietTo: m0.quiet_to || s.quietTo,
    device: one((notify0.data || {}).device_id) || panelDevice });
  for (const ev of EVENTS) s.events[ev.key].on = false;
  for (const cfg of found) {
    const m = cfg.variables.orbitdmd;
    if (!s.events[m.event]) continue;
    Object.assign(s.events[m.event], { on: true, text: String(m.text ?? s.events[m.event].text), icon: m.icon || s.events[m.event].icon,
      color: m.color || s.events[m.event].color, effect: m.effect || s.events[m.event].effect, prio: !!m.prio });
  }
  return s;
}

const one = (v) => (Array.isArray(v) ? v[0] : v);

function findNotify(list) {
  for (const a of [].concat(list || [])) if (a && a.action === "orbitdmd.notify") return a;
  return null;
}

// chaine Jinja entre apostrophes
const jstr = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

// texte de l'utilisateur -> modele : {name}, {duration}... remplaces, accolades retirees
// (pas de modele Jinja ecrit a la main par erreur)
export function textTemplate(text) {
  let s = String(text || "");
  const marks = {};
  TOKENS.forEach((k, i) => { const m = `\u0001${i}\u0002`; marks[m] = `{{ ax_${k} }}`; s = s.split(`{${k}}`).join(m); });
  s = s.replace(/[{}]/g, "");
  for (const [m, v] of Object.entries(marks)) s = s.split(m).join(v);
  return s;
}

// valeurs calculees au moment de l'alerte, selon l'evenement (Jinja, place avant le texte)
function prelude(key, t) {
  const word = jstr(t.ax_word_timer);
  const room = "{%- set ax_room = area_name(trigger.entity_id) or device_attr(device_id(trigger.entity_id), 'name_by_user') or device_attr(device_id(trigger.entity_id), 'name') or '' -%}";
  const P = {
    // le minuteur le plus recent parmi ceux en cours (nom et duree d'origine)
    timer_start: "{%- set a = trigger.to_state.attributes -%}"
      + "{%- set on = (a.get('sorted_all') or []) | selectattr('status', 'eq', 'ON') | sort(attribute='createdDate') | list -%}"
      + "{%- set n = on | last if on else none -%}"
      + "{%- set lab = (n.get('timerLabel') if n is not none else '') or a.get('timer') or '' -%}"
      + `{%- set ax_name = lab if lab else ${word} -%}`
      + "{%- set mins = (((n.get('originalDurationInMillis', 0) if n is not none else 0) | int(0)) / 60000) | round(0) | int -%}"
      + "{%- set ax_duration = '' if mins == 0 else (mins ~ ' min' if mins < 60 else (mins // 60) ~ ' h' ~ (' %02d' % (mins % 60) if mins % 60 else '')) -%}",
    // le minuteur qui sonne est le "prochain" de l'Echo
    timer_done: `{%- set lab = state_attr(trigger.entity_id, 'timer') or '' -%}{%- set ax_name = lab if lab else ${word} -%}`,
    // le minuteur qui a disparu de la liste
    timer_cancel: "{%- set f = trigger.from_state.attributes -%}{%- set g = trigger.to_state.attributes -%}"
      + "{%- set ids = ((g.get('brief') or {}).get('active') or []) | map(attribute='id') | list -%}"
      + "{%- set gone = ((f.get('brief') or {}).get('active') or []) | rejectattr('id', 'in', ids) | list -%}"
      + "{%- set lab = (gone[0].get('label') if gone else '') or '' -%}"
      + `{%- set ax_name = lab if lab else ${word} -%}`,
    reminder: "{%- set ax_text = state_attr(trigger.entity_id, 'reminder') or '' -%}",
    alarm: "{%- set ax_time = now().strftime('%H:%M') -%}",
    music: "{%- set ax_title = trigger.to_state.attributes.get('media_title') or '' -%}{%- set ax_artist = trigger.to_state.attributes.get('media_artist') or '' -%}",
  };
  return room + P[key];
}

// modele complet du message : valeurs, piece (option), texte ; espaces en trop retires
export function messageTemplate(key, ev, settings, t) {
  const roomPart = settings.room ? "{{ ax_room ~ ' : ' if ax_room else '' }}" : "";
  return `${prelude(key, t)}{%- set out -%}${roomPart}${textTemplate(ev.text)}{%- endset -%}{{ out | regex_replace('\\s+', ' ') | trim }}`;
}

// declencheurs et conditions d'un evenement, pour les entites des appareils coches
function triggerPart(key, entities) {
  if (key === "timer_start") return {
    triggers: [{ trigger: "state", entity_id: entities, not_from: ["unavailable"] }],
    conditions: [{ condition: "template", value_template: "{{ trigger.from_state is not none and trigger.to_state.state not in ['unknown', 'unavailable', ''] and (trigger.to_state.attributes.get('total_active', 0) | int(0)) > (trigger.from_state.attributes.get('total_active', 0) | int(0)) }}" }] };
  if (key === "timer_cancel") return {
    triggers: [{ trigger: "state", entity_id: entities, not_from: ["unavailable"], not_to: ["unavailable"] }],
    // moins de minuteurs alors que le prochain n'etait pas encore arrive a son heure : annule, pas termine
    conditions: [{ condition: "template", value_template: "{{ trigger.from_state is not none and (trigger.to_state.attributes.get('total_active', 0) | int(0)) < (trigger.from_state.attributes.get('total_active', 0) | int(0)) and as_timestamp(trigger.from_state.state, 0) > as_timestamp(now()) + 3 }}" }] };
  if (key === "music") return {
    triggers: [{ trigger: "state", entity_id: entities, attribute: "media_title" }],
    conditions: [{ condition: "template", value_template: "{{ trigger.to_state.state == 'playing' and trigger.to_state.attributes.get('media_title') and trigger.to_state.attributes.get('media_title') != (trigger.from_state.attributes.get('media_title') if trigger.from_state else '') }}" }] };
  // minuteur termine, rappel, alarme : a l'heure exacte donnee par le capteur
  return { triggers: [{ trigger: "time", at: entities }], conditions: [] };
}

// automatisations a enregistrer : { id: config } pour les evenements actifs, et ids a supprimer
export function alexaConfigs(settings, devices, t) {
  const chosen = devices.filter((d) => settings.echos.includes(d.id));
  const save = {}, remove = [];
  for (const ev of EVENTS) {
    const id = ID_PREFIX + ev.key;
    const e = settings.events[ev.key];
    const entities = chosen.map((d) => d[ev.sensor]).filter(Boolean);
    if (!e.on || !entities.length) { remove.push(id); continue; }
    const { triggers, conditions } = triggerPart(ev.key, entities);
    if (settings.quiet && !e.prio) {
      conditions.push({ condition: "not", conditions: [{ condition: "time", after: `${settings.quietFrom}:00`, before: `${settings.quietTo}:00` }] });
    }
    const data = { device_id: [settings.device], icon: e.icon, message: messageTemplate(ev.key, e, settings, t), color: e.color, effect: e.effect };
    if (e.prio) { data.blink = true; data.passes = 2; }
    save[id] = {
      id, alias: `OrbitDMD – Alexa : ${t[`ax_ev_${ev.key}`]}`, description: t.ax_description,
      variables: { orbitdmd: { kind: "alexa", event: ev.key, echos: settings.echos.slice(), room: settings.room,
        quiet: settings.quiet, quiet_from: settings.quietFrom, quiet_to: settings.quietTo,
        text: e.text, icon: e.icon, color: e.color, effect: e.effect, prio: e.prio, display: "icon" } },
      triggers, conditions, actions: [{ action: "orbitdmd.notify", data }],
      mode: "queued", max: 5,
    };
  }
  return { save, remove };
}

// texte d'exemple (apercu, bouton Tester) : jetons remplaces par des valeurs d'exemple
export function sampleText(key, ev, settings, t, roomName) {
  const values = { name: t.ax_sample_name, duration: t.ax_sample_duration, text: t.ax_sample_text, time: "07:30",
    title: t.ax_sample_title, artist: t.ax_sample_artist };
  let s = String(ev.text || "");
  for (const k of TOKENS) s = s.split(`{${k}}`).join(values[k]);
  s = s.replace(/[{}]/g, "");
  if (settings.room && roomName) s = `${roomName} : ${s}`;
  return s.replace(/\s+/g, " ").trim();
}
