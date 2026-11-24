// Idees d'alertes de la page OrbitDMD : des alertes toutes pretes, trouvees d'apres les appareils
// de Home Assistant (sonnette, fumee, portes, alarme, piles, musique...).
// Chaque idee donne un ou plusieurs brouillons d'alerte ordinaires (memes reglages que l'assistant) :
// une fois ajoutees, ces alertes se modifient comme les autres. variables.orbitdmd.recipe garde l'idee.

// nom de l'appareil qui declenche ("Fenetre salon" plutot que "Fenetre salon Contact")
export const DEVICE_TPL = "{{ device_attr(device_id(trigger.entity_id), 'name_by_user') or device_attr(device_id(trigger.entity_id), 'name') or trigger.to_state.name }}";
const MUSIC_TEXT = "{{ trigger.to_state.attributes.media_title }} - {{ trigger.to_state.attributes.media_artist }}";

const dc = (s) => s.attributes.device_class || "";
const domain = (s) => s.entity_id.split(".")[0];
const ok = (s) => s && s.state !== "unavailable";
// appareils menagers : nom de la prise ou du capteur -> GIF "termine"
const APPLIANCES = [
  [/lave.?linge|machine.{0,4}laver|washing|washer|wasch/i, "lave_linge_termine"],
  [/vaisselle|dish|sp[uü]l/i, "vaisselle_propre"],
  [/s[eè]che|dryer|trockner/i, "sechage_termine"],
  [/imprim|printer|3d/i, "impression_terminee"],
];

// les idees, dans l'ordre de la page ; find(hass) -> entites concernees ; drafts(liste, ctx) -> brouillons
export const IDEAS = [
  { key: "doorbell", gifs: ["sonnette"],
    find: (st) => st.filter((s) => dc(s) === "doorbell" && ["binary_sensor", "event"].includes(domain(s))),
    drafts: (ents) => split(ents, (e) => (e.startsWith("event.") ? null : "on")).map(([list, to]) => ({ entities: list, to, cooldown: 1 })) },
  { key: "smoke", gifs: ["incendie"], prio: true,
    find: (st) => st.filter((s) => domain(s) === "binary_sensor" && dc(s) === "smoke"),
    drafts: (ents) => [{ entities: ents, to: "on", priority: true, repeat: 1 }] },
  { key: "gas", gifs: ["gaz_detecte", "incendie"], prio: true,
    find: (st) => st.filter((s) => domain(s) === "binary_sensor" && dc(s) === "gas"),
    drafts: (ents) => [{ entities: ents, to: "on", priority: true, repeat: 1 }] },
  { key: "co", gifs: ["monoxyde_carbone", "incendie"], prio: true,
    find: (st) => st.filter((s) => domain(s) === "binary_sensor" && dc(s) === "carbon_monoxide"),
    drafts: (ents) => [{ entities: ents, to: "on", priority: true, repeat: 1 }] },
  { key: "leak", gifs: ["fuite_eau"], prio: true,
    find: (st) => st.filter((s) => domain(s) === "binary_sensor" && dc(s) === "moisture"),
    drafts: (ents) => [{ entities: ents, to: "on", priority: true, repeat: 2 }] },
  // portes et fenetres restees ouvertes 10 minutes : icone + nom de l'appareil
  { key: "open", gifs: ["porte_ouverte", "fenetre_ouverte"], icon: true,
    find: (st) => st.filter((s) => domain(s) === "binary_sensor" && ["door", "window", "opening", "garage_door"].includes(dc(s))),
    drafts: (ents, c) => [{ entities: ents, to: "on", forMin: 10, mode: "icon", message: `${DEVICE_TPL} : ${c.t.rc_open_text}` }] },
  { key: "garage", gifs: ["garage_ouvert", "portail_ouvert"],
    find: (st) => st.filter((s) => domain(s) === "cover" && ["garage", "gate"].includes(dc(s))),
    drafts: (ents) => [{ entities: ents, to: "open" }] },
  // alarme : declenchee (prioritaire), armee, desarmee
  { key: "alarm", gifs: ["intrusion", "alarme_activee"], multi: true,
    find: (st) => st.filter((s) => domain(s) === "alarm_control_panel"),
    drafts: (ents, c) => [
      { entities: ents, to: "triggered", priority: true, repeat: 1, gif: c.gif(["intrusion", "alarme_activee"]) },
      { entities: ents, to: "armed_away", gif: c.gif(["alarme_activee"]) },
      { entities: ents, to: "disarmed", gif: c.gif(["alarme_desactivee"]) },
    ] },
  // retour a la maison : « Bienvenue Ulrik »
  { key: "arrive", gifs: ["retour_maison"], icon: true,
    find: (st) => st.filter((s) => domain(s) === "person" && (s.attributes.device_trackers || []).length),
    drafts: (ents, c) => [{ entities: ents, to: "home", mode: "icon", message: `${c.t.rc_welcome} {{ trigger.to_state.name }}` }] },
  // personne vue par une camera
  { key: "person", gifs: ["presence_detectee", "visiteur"],
    find: (st) => st.filter((s) => domain(s) === "binary_sensor" && ["motion", "occupancy", "presence"].includes(dc(s))
      && /person|personne|people|human/i.test(s.entity_id)),
    drafts: (ents) => [{ entities: ents, to: "on", cooldown: 5 }] },
  // piles faibles : capteurs en % sous 15 %, et capteurs « pile faible »
  { key: "battery", gifs: ["batterie_faible"], icon: true,
    find: (st) => st.filter((s) => dc(s) === "battery" && ((domain(s) === "sensor" && s.attributes.unit_of_measurement === "%")
      || domain(s) === "binary_sensor")),
    drafts: (ents, c) => {
      const pct = ents.filter((e) => e.startsWith("sensor.")), low = ents.filter((e) => e.startsWith("binary_sensor."));
      return [
        ...(pct.length ? [{ entities: pct, trig: "value", cmp: "below", threshold: "15", mode: "icon",
          message: `${DEVICE_TPL} : ${c.valueTpl("trigger.entity_id")}` }] : []),
        ...(low.length ? [{ entities: low, to: "on", mode: "icon", message: `${DEVICE_TPL} : ${c.t.rc_battery_low}` }] : []),
      ];
    } },
  // musique : tous les lecteurs, sauf ceux d'Alexa (menu Alexa)
  { key: "music", gifs: ["musique", "enceinte_allumee"], icon: true,
    find: (st, hass) => st.filter((s) => domain(s) === "media_player"
      && ((hass.entities || {})[s.entity_id] || {}).platform !== "alexa_media"),
    drafts: (ents) => [{ entities: ents, trig: "music", mode: "icon", message: MUSIC_TEXT, color: "violet", effect: "defile" }] },
];

// appareils menagers : une idee par prise ou capteur de puissance reconnu (« Lave-linge termine »)
function applianceIdeas(st) {
  const out = [];
  for (const s of st) {
    if (domain(s) !== "sensor" || dc(s) !== "power") continue;
    const name = `${s.attributes.friendly_name || ""} ${s.entity_id}`;
    const hit = APPLIANCES.find(([re]) => re.test(name));
    if (!hit) continue;
    out.push({ key: `appliance:${s.entity_id}`, recipe: "appliance", gifs: [hit[1]], title: s.attributes.friendly_name || s.entity_id,
      entities: [s.entity_id],
      drafts: (ents) => [{ entities: ents, trig: "value", cmp: "below", threshold: "5", forMin: 3 }] });
  }
  return out;
}

// separe une liste d'entites selon une valeur (ex. etat vise) : [[entites, valeur], ...]
function split(ents, by) {
  const m = new Map();
  for (const e of ents) { const k = by(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
  return [...m.entries()];
}

// idees trouvees chez l'utilisateur : [{ key, recipe, title, gif, icon, entities, drafts(choisies) }]
// ctx : { t, gifs (liste du panneau), valueTpl }
export function findIdeas(hass, ctx) {
  const st = Object.values(hass.states).filter(ok);
  const gif = (names) => {
    for (const n of names) if (ctx.gifs.includes(`Domotique/${n}.gif`)) return `Domotique/${n}.gif`;
    return "";
  };
  const icon = (names) => {
    for (const n of names) if (ctx.gifs.includes(`Icones/${n}.gif`)) return `Icones/${n}.gif`;
    return "";
  };
  const c = { t: ctx.t, valueTpl: ctx.valueTpl, gif };
  const list = [];
  for (const idea of IDEAS) {
    const ents = idea.find(st, hass).map((s) => s.entity_id).sort();
    if (!ents.length) continue;
    list.push({ key: idea.key, recipe: idea.key, title: ctx.t[`rc_${idea.key}`], entities: ents, prio: !!idea.prio,
      gif: gif(idea.gifs), icon: icon(idea.gifs), useIcon: !!idea.icon, drafts: (chosen) => idea.drafts(chosen, c) });
  }
  for (const a of applianceIdeas(st)) {
    list.push({ ...a, title: `${ctx.t.rc_appliance} : ${a.title}`, gif: gif(a.gifs), icon: icon(a.gifs), useIcon: false,
      drafts: (chosen) => a.drafts(chosen, c) });
  }
  return list;
}
