// Page "OrbitDMD" de Home Assistant : alertes du panneau, creees pas a pas.
// 1. GIF (vignettes animees)  2. declencheur (une ou plusieurs entites + etat)  3. message
// 4. options (heures de silence, anti-repetition, priorite) et enregistrement.
// Chaque alerte est une automatisation ordinaire de Home Assistant (id "orbitdmd_...", categorie
// "OrbitDMD") qui appelle l'action orbitdmd.notify : elle reste visible dans Automatisations.
// Les reglages de l'assistant sont gardes dans variables.orbitdmd de l'automatisation.

// textes en 12 langues : orbitdmd-i18n.js (meme empreinte "?v=" que ce fichier, pour le cache)
const { pickLanguage } = await import(new URL(`./orbitdmd-i18n.js${new URL(import.meta.url).search}`, import.meta.url).href);

const EFFECTS = ["defile", "inverse", "monte", "descend", "lettres", "pluie", "fondu"];
const COLORS = {
  blanc: "#ffffff", rouge: "#ff2a2a", orange: "#ff8a00", ambre: "#ffb800", jaune: "#ffee00", vert: "#2bff3a",
  turquoise: "#22e3d2", bleu: "#3a6bff", violet: "#a24bff", rose: "#ff52b4",
  "arc-en-ciel": "linear-gradient(90deg,#ff2a2a,#ffee00,#2bff3a,#22e3d2,#3a6bff,#ff52b4)",
};
// etats proposes selon le type d'entite (les autres : "n'importe quel changement" ou etat libre)
const STATES = {
  binary_sensor: ["on", "off"], switch: ["on", "off"], light: ["on", "off"], input_boolean: ["on", "off"],
  fan: ["on", "off"], siren: ["on", "off"], lock: ["unlocked", "locked", "open", "jammed"],
  cover: ["open", "closed", "opening", "closing"], person: ["home", "not_home"], device_tracker: ["home", "not_home"],
  alarm_control_panel: ["triggered", "armed_away", "armed_home", "armed_night", "disarmed"],
  media_player: ["playing", "paused", "idle", "off"], vacuum: ["cleaning", "docked", "returning", "error"],
  climate: ["heat", "cool", "auto", "off"], sun: ["above_horizon", "below_horizon"],
};
const SUGGESTED = ["event", "binary_sensor", "lock", "cover", "alarm_control_panel", "person", "input_boolean", "switch", "vacuum"];
const COOLDOWNS = [0, 1, 2, 5, 10, 15, 30, 60];
const REPEATS = [0, 1, 2, 5, 10];
const MAX_REPEATS = 30;      // une alerte prioritaire se repete 30 fois au plus

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmt = (s, ...a) => a.reduce((r, v) => r.replace("{}", v), s);
const gifLabel = (g) => (g || "").split("/").slice(1).join("/").replace(/\.gif$/i, "").replace(/_/g, " ");
const hhmm = (v, dflt) => (/^\d{2}:\d{2}/.test(v || "") ? v.slice(0, 5) : dflt);

const CSS = `
:host { display:block; min-height:100vh; background:var(--primary-background-color); color:var(--primary-text-color);
  font-family:var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
.top { display:flex; align-items:center; gap:8px; height:56px; padding:0 12px; background:var(--app-header-background-color, var(--primary-color));
  color:var(--app-header-text-color, #fff); position:sticky; top:0; z-index:2; }
.top .title { font-size:20px; flex:1; }
.links { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
a.admin { color:inherit; text-decoration:none; font-size:14px; padding:7px 12px; border-radius:8px; white-space:nowrap;
  border:1px solid rgba(255,255,255,.45); }
a.admin:hover { background:rgba(255,255,255,.15); }
.wrap { max-width:1040px; margin:0 auto; padding:16px; box-sizing:border-box; }
.banner { background:var(--warning-color, #ffa600); color:#000; border-radius:10px; padding:12px 16px; margin-bottom:14px; font-weight:500; }
h2 { font-size:22px; font-weight:500; margin:8px 0 4px; }
h3 { font-size:17px; font-weight:500; margin:18px 0 8px; }
.muted { color:var(--secondary-text-color); }
.help { color:var(--secondary-text-color); margin:0 0 14px; }
.card { background:var(--card-background-color); border-radius:var(--ha-card-border-radius, 12px); padding:16px;
  border:1px solid var(--divider-color); box-shadow:var(--ha-card-box-shadow, none); }
button { font:inherit; cursor:pointer; border-radius:8px; border:1px solid var(--divider-color); background:var(--card-background-color);
  color:var(--primary-text-color); padding:8px 14px; }
button:hover { border-color:var(--primary-color); }
button:disabled { opacity:.5; cursor:default; }
button.primary { background:var(--primary-color); border-color:var(--primary-color); color:var(--text-primary-color, #fff); font-weight:500; }
button.danger { color:var(--error-color, #db4437); }
button.danger.armed { background:var(--error-color, #db4437); color:#fff; border-color:transparent; }
button.link { border:none; background:none; color:var(--primary-color); padding:6px 0; }
input[type=text], input[type=search], input[type=time], select { font:inherit; color:var(--primary-text-color); background:var(--secondary-background-color, transparent);
  border:1px solid var(--divider-color); border-radius:8px; padding:9px 12px; box-sizing:border-box; }
input[type=text]:focus, input[type=search]:focus, input[type=time]:focus, select:focus { outline:2px solid var(--primary-color); border-color:transparent; }
input[type=checkbox] { width:18px; height:18px; accent-color:var(--primary-color); margin:0; }
label.field { display:flex; flex-direction:column; gap:6px; font-size:14px; color:var(--secondary-text-color); }
.opt { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 0; border-top:1px solid var(--divider-color); }
.opt.off > :not(.lead) { opacity:.5; }
.opt .lead { display:flex; align-items:center; gap:10px; cursor:pointer; }
.opt small { flex-basis:100%; color:var(--secondary-text-color); }
.row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.grow { flex:1; }
.bar { display:flex; gap:10px; align-items:center; margin:16px 0; flex-wrap:wrap; }
/* etapes */
.steps { display:flex; gap:6px; margin:4px 0 16px; }
.step { flex:1; display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; color:var(--secondary-text-color);
  background:var(--card-background-color); border:1px solid var(--divider-color); font-size:14px; min-width:0; }
.step b { display:inline-flex; width:24px; height:24px; border-radius:50%; align-items:center; justify-content:center; flex:none;
  background:var(--divider-color); color:var(--primary-text-color); font-size:13px; }
.step.on { border-color:var(--primary-color); color:var(--primary-text-color); }
button.step { text-align:left; font-size:14px; color:var(--primary-text-color); }
.step.on b, .step.done b { background:var(--primary-color); color:var(--text-primary-color, #fff); }
.step span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.nav { display:flex; justify-content:space-between; gap:10px; margin-top:16px; }
/* GIF */
.chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
.chip { padding:6px 12px; border-radius:16px; font-size:14px; }
.chip.on { background:var(--primary-color); color:var(--text-primary-color, #fff); border-color:var(--primary-color); }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:10px; }
.tile { padding:0; overflow:hidden; display:flex; flex-direction:column; border:2px solid transparent; background:var(--card-background-color);
  outline:1px solid var(--divider-color); }
.tile.on { border-color:var(--primary-color); outline-color:var(--primary-color); }
.tile .scr { background:#000; aspect-ratio:4/1; display:flex; align-items:center; justify-content:center; color:#888; white-space:pre-line;
  font-size:12px; line-height:1.2; text-align:center; }
.tile span.n { padding:5px 8px; font-size:13px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
img.gif { width:100%; height:100%; image-rendering:pixelated; display:block; object-fit:contain; }
img.gif:not([src]) { visibility:hidden; }
/* entites */
.elist { display:flex; flex-direction:column; gap:6px; margin-top:10px; max-height:420px; overflow:auto; }
.erow { text-align:left; display:flex; flex-direction:column; gap:2px; }
.erow small, .sel small { color:var(--secondary-text-color); }
.sels { display:flex; flex-direction:column; gap:6px; }
.sel { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; border:1px solid var(--primary-color); }
/* message */
.swatches { display:flex; gap:8px; flex-wrap:wrap; }
.sw { width:34px; height:34px; padding:0; border-radius:50%; border:2px solid var(--divider-color); }
.sw.on { outline:3px solid var(--primary-color); outline-offset:2px; }
.cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-top:14px; }
.preview { display:flex; flex-direction:column; gap:6px; max-width:512px; margin-top:16px; }
.screen { background:#000; aspect-ratio:4/1; border-radius:6px; overflow:hidden; position:relative; display:flex; align-items:center;
  justify-content:center; color:#888; }
#pv { justify-content:flex-start; }
.marquee { white-space:nowrap; font:bold 30px/1 "Courier New", monospace; letter-spacing:2px; padding-left:100%; animation:mq 7s linear infinite; }
.marquee.blink { animation:mq 7s linear infinite, bl .7s step-end infinite; }
@keyframes mq { to { transform:translateX(-100%); } }
@keyframes bl { 64% { opacity:0; } }
/* alertes */
.alerts { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.alert { display:grid; grid-template-columns:200px 1fr auto; gap:14px; align-items:center; }
.alert .scr { background:#000; aspect-ratio:4/1; border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center; color:#999; }
.alert .info { display:flex; flex-direction:column; gap:3px; min-width:0; }
.alert .info b { font-size:16px; }
.alert .info span { color:var(--secondary-text-color); font-size:14px; overflow:hidden; text-overflow:ellipsis; }
.alert .acts { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; align-items:center; }
.alert.off { opacity:.55; }
.badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:2px; }
.badge { font-size:12px; padding:2px 8px; border-radius:10px; background:var(--secondary-background-color, rgba(127,127,127,.15));
  color:var(--secondary-text-color); }
.badge.prio { background:var(--error-color, #db4437); color:#fff; }
.toggle { position:relative; width:42px; height:24px; flex:none; }
.toggle input { opacity:0; width:100%; height:100%; margin:0; cursor:pointer; position:absolute; z-index:1; }
.toggle i { position:absolute; inset:0; border-radius:12px; background:var(--divider-color); transition:.2s; }
.toggle i::after { content:""; position:absolute; width:18px; height:18px; top:3px; left:3px; border-radius:50%; background:#fff; transition:.2s; }
.toggle input:checked + i { background:var(--primary-color); }
.toggle input:checked + i::after { left:21px; }
.sum { display:grid; grid-template-columns:auto 1fr; gap:8px 16px; margin-top:14px; }
.sum dt { color:var(--secondary-text-color); }
.sum dd { margin:0; }
#toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:#323232; color:#fff; padding:12px 18px;
  border-radius:8px; opacity:0; pointer-events:none; transition:opacity .2s; z-index:5; max-width:90vw; }
#toast.show { opacity:1; }
@media (max-width:640px) {
  .alert { grid-template-columns:1fr; }
  .alert .acts { justify-content:flex-start; }
  .step span { display:none; }
  .step { justify-content:center; }
}
`;

class OrbitDMDPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._view = "home";          // "home" ou 1..4
    this._data = null;            // { panels, notify_category }
    this._configs = {};           // id d'automatisation -> configuration
    this._thumbs = new Map();     // "entry|gif" -> URL de l'image
    this._waiting = new Map();
    this._queue = [];
    this._active = 0;
    this._q = "";
    this._eq = "";
    this._cat = null;
    this._sig = "";
    this.shadowRoot.addEventListener("click", (e) => this._click(e));
    this.shadowRoot.addEventListener("input", (e) => this._input(e));
    this.shadowRoot.addEventListener("change", (e) => this._input(e));
    // Home Assistant peut creer l'element et lui donner hass/narrow AVANT que ce fichier soit charge
    // (chargement des traductions) : ces valeurs restent alors "posees" sur l'element et masquent
    // les setters de la classe. On les reprend pour passer par les setters.
    for (const prop of ["hass", "narrow", "panel", "route"]) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const value = this[prop];
        delete this[prop];
        this[prop] = value;
      }
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    const mb = this.shadowRoot.querySelector("ha-menu-button");
    if (mb) mb.hass = hass;
    if (first) {
      this._t = pickLanguage(hass.language);
      this._render();
      this._load();
    } else if (this._data) {
      if (this._view === "home" && this._signature() !== this._sig) this._loadConfigs().then(() => this._render());
      if (Date.now() - (this._checked || 0) > 20000) this._checkOnline();
    }
  }

  // le panneau repond-il ? (relu toutes les 20 s au plus, au rythme des mises a jour de Home Assistant)
  async _checkOnline() {
    this._checked = Date.now();
    try {
      const fresh = await this._hass.callWS({ type: "orbitdmd/panels" });
      const was = this._data.panels.map((p) => p.online).join();
      for (const p of this._data.panels) {
        const f = fresh.panels.find((x) => x.entry_id === p.entry_id);
        if (f) p.online = f.online;
      }
      if (this._data.panels.map((p) => p.online).join() !== was) this._renderBanner();
    } catch (e) { /* Home Assistant en cours de redemarrage */ }
  }

  _renderBanner() {
    const box = this.shadowRoot.getElementById("banner");
    if (!box || !this._data) return;
    const t = this._t;
    box.innerHTML = this._data.panels.filter((p) => p.online === false)
      .map((p) => `<div class="banner">⚠ ${esc(fmt(t.offline, p.title))}</div>`).join("");
  }
  set narrow(n) { this._narrow = n; const mb = this.shadowRoot.querySelector("ha-menu-button"); if (mb) mb.narrow = n; }
  set panel(p) {}
  set route(r) {}

  async _load() {
    try {
      this._data = await this._hass.callWS({ type: "orbitdmd/panels" });
    } catch (err) {
      this._data = { panels: [], notify_category: "Domotique" };
      this._toast(fmt(this._t.error, err.message || err));
    }
    await this._loadConfigs();
    this._render();
    this._categorizeAll();
  }

  _autos() {
    return Object.values(this._hass.states)
      .filter((s) => s.entity_id.startsWith("automation.") && String(s.attributes.id || "").startsWith("orbitdmd_"))
      .sort((a, b) => fold(a.attributes.friendly_name).localeCompare(fold(b.attributes.friendly_name)));
  }

  _signature() {
    return this._autos().map((s) => `${s.entity_id}:${s.state}:${s.attributes.id}:${s.attributes.last_triggered}`).join("|");
  }

  async _loadConfigs() {
    this._sig = this._signature();
    await Promise.all(this._autos().map(async (s) => {
      const id = s.attributes.id;
      if (this._configs[id]) return;
      try { this._configs[id] = await this._hass.callApi("GET", `config/automation/config/${id}`); } catch (e) { /* ignore */ }
    }));
  }

  // ---------- categorie "OrbitDMD" dans la liste des automatisations ----------

  async _categoryId() {
    if (this._catId) return this._catId;
    const list = await this._hass.callWS({ type: "config/category_registry/list", scope: "automation" });
    let cat = list.find((c) => c.name === "OrbitDMD");
    if (!cat) cat = await this._hass.callWS({ type: "config/category_registry/create", scope: "automation", name: "OrbitDMD", icon: "mdi:dots-grid" });
    this._catId = cat.category_id;
    return this._catId;
  }

  async _categorize(entityId) {
    try {
      const cid = await this._categoryId();
      const entry = await this._hass.callWS({ type: "config/entity_registry/get", entity_id: entityId });
      if (entry.categories && entry.categories.automation === cid) return;
      await this._hass.callWS({ type: "config/entity_registry/update", entity_id: entityId, categories: { automation: cid } });
    } catch (e) { /* categories : Home Assistant 2024.4 ou plus recent */ }
  }

  async _categorizeAll() {
    for (const s of this._autos()) await this._categorize(s.entity_id);
  }

  async _categorizeId(id) {
    // l'automatisation apparait quelques instants apres l'enregistrement
    for (let i = 0; i < 25; i++) {
      const s = this._autos().find((x) => x.attributes.id === id);
      if (s) { await this._categorize(s.entity_id); return; }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // ---------- affichage ----------

  _render() {
    const t = this._t, root = this.shadowRoot;
    if (!root.querySelector(".top")) {
      const menu = customElements.get("ha-menu-button") ? "<ha-menu-button></ha-menu-button>" : "";
      root.innerHTML = `<style>${CSS}</style><div class="top">${menu}<div class="title">OrbitDMD</div><div class="links" id="links"></div></div>
        <div class="wrap"><div id="banner"></div><div id="main"></div></div><div id="toast"></div>`;
      const mb = root.querySelector("ha-menu-button");
      if (mb) { mb.hass = this._hass; mb.narrow = this._narrow; }
    }
    const main = root.getElementById("main");
    if (!this._data) { main.innerHTML = `<p class="muted">${t.loading}</p>`; return; }
    // "Gerer le panneau" : sa page web dans un nouvel onglet (un bouton par panneau s'il y en a plusieurs)
    const panels = this._data.panels.filter((p) => p.url);
    root.getElementById("links").innerHTML = panels.map((p) => `<a class="admin" href="${esc(p.url)}/" target="_blank" rel="noopener"
      title="${esc(p.url)}">⚙ ${esc(panels.length > 1 ? fmt(t.admin_n, p.title) : t.admin)}</a>`).join("");
    this._renderBanner();
    if (!this._data.panels.length) { main.innerHTML = `<div class="card">${esc(t.no_panel)}</div>`; return; }
    main.innerHTML = this._view === "home" ? this._home() : this._wizard();
    if (this._view === 1) this._renderGrid();
    if (this._view === 2) this._renderEntities();
    this._observe();
  }

  _panelOf(deviceId) {
    const p = this._data.panels;
    return p.find((x) => x.device_id === deviceId) || p[0];
  }

  _screen(deviceId, gif, cls = "scr") {
    if (!gif) return `<div class="${cls}">Aa</div>`;
    const p = this._panelOf(deviceId);
    return `<div class="${cls}"><img class="gif" data-entry="${esc(p.entry_id)}" data-gif="${esc(gif)}" alt=""></div>`;
  }

  _name(entityId) {
    const s = this._hass.states[entityId];
    return (s && s.attributes.friendly_name) || entityId || "";
  }

  _state(entityId, value) {
    const so = this._hass.states[entityId];
    if (!so) return value;
    try { return this._hass.formatEntityState ? this._hass.formatEntityState(so, value) : value; } catch (e) { return value; }
  }

  _value(entityId) {      // valeur actuelle, comme Home Assistant l'affiche ("21,5 °C")
    const so = this._hass.states[entityId];
    if (!so) return "?";
    try { return this._hass.formatEntityState ? this._hass.formatEntityState(so) : so.state; } catch (e) { return so.state; }
  }

  _names(d) { return d.entities.map((e) => this._name(e)).join(this._t.or); }

  _whenText(d) {
    const n = this._names(d);
    return d.to === null ? fmt(this._t.when_any, n) : fmt(this._t.when_to, n, this._state(d.entities[0], d.to));
  }

  _autoName(d) {
    const n = d.entities.length ? d.entities.map((e) => this._name(e)).join(" / ") : gifLabel(d.gif);
    return d.entities.length && d.to !== null ? `${n} – ${this._state(d.entities[0], d.to)}` : n;
  }

  _home() {
    const t = this._t;
    const rows = this._autos().map((s) => {
      const cfg = this._configs[s.attributes.id];
      const d = cfg ? this._parse(cfg) : null;
      const on = s.state === "on";
      const last = s.attributes.last_triggered
        ? fmt(t.last, new Date(s.attributes.last_triggered).toLocaleString(this._hass.language)) : t.never;
      const armed = this._confirm === s.attributes.id;
      const badges = d ? [
        d.priority ? `<span class="badge prio">${t.b_prio}${d.repeat ? " · " + fmt(t.b_repeat, d.repeat) : ""}</span>` : "",
        d.quiet && !d.priority ? `<span class="badge">${esc(fmt(t.b_quiet, d.quietFrom, d.quietTo))}</span>` : "",
        d.cooldown && !d.priority ? `<span class="badge">${esc(fmt(t.b_cool, d.cooldown))}</span>` : "",
      ].join("") : "";
      const id = esc(s.attributes.id);
      return `<div class="card alert ${on ? "" : "off"}">
        ${this._screen(d && d.device, d && d.gif)}
        <div class="info"><b>${esc(String(s.attributes.friendly_name || "").replace(/^OrbitDMD\s*[–-]\s*/, ""))}</b>
          ${d ? `<span>${esc(this._whenText(d))}</span>` : ""}
          ${d && d.message ? `<span>« ${esc(this._sample(d.message, d))} »</span>` : ""}
          <span>${esc(last)}</span>
          ${badges ? `<div class="badges">${badges}</div>` : ""}</div>
        <div class="acts">
          <label class="toggle" title="${esc(s.entity_id)}"><input type="checkbox" data-a="toggle" data-e="${esc(s.entity_id)}" ${on ? "checked" : ""}><i></i></label>
          <button data-a="testauto" data-id="${id}" ${d ? "" : "disabled"}>${t.test}</button>
          <button data-a="edit" data-id="${id}" ${d ? "" : "disabled"}>${t.edit}</button>
          <button data-a="dup" data-id="${id}" ${d ? "" : "disabled"} title="${esc(t.dup_help)}">${t.dup}</button>
          <button class="danger ${armed ? "armed" : ""}" data-a="del" data-id="${id}">${armed ? t.confirm_del : t.del}</button>
        </div></div>`;
    }).join("");
    return `<h2>${t.home_title}</h2><p class="help">${t.home_intro}</p>
      <button class="primary" data-a="new">+ ${t.new}</button>
      <div class="alerts">${rows || `<div class="card muted">${t.none}</div>`}</div>`;
  }

  _wizard() {
    const t = this._t, st = this._view;
    // les etapes deja faites sont cliquables (revenir en arriere directement)
    const steps = t.steps.map((n, i) => (i + 1 < st
      ? `<button class="step done" data-a="goto" data-s="${i + 1}"><b>${i + 1}</b><span>${n}</span></button>`
      : `<div class="step ${i + 1 === st ? "on" : ""}"><b>${i + 1}</b><span>${n}</span></div>`)).join("");
    const body = [null, this._step1, this._step2, this._step3, this._step4][st].call(this);
    const next = st < 4 ? `<button class="primary" data-a="next">${t.next}</button>` : `<button class="primary" data-a="save">${t.save}</button>`;
    return `<div class="steps">${steps}</div><div class="card">${body}</div>
      <div class="nav"><button data-a="back">${st === 1 ? t.cancel : t.back}</button>${next}</div>`;
  }

  _cats(panel) {
    const counts = {};
    for (const g of panel.gifs) { const c = g.split("/")[0]; counts[c] = (counts[c] || 0) + 1; }
    const nc = this._data.notify_category;
    return Object.keys(counts).sort((a, b) => (a === nc ? -1 : b === nc ? 1 : fold(a).localeCompare(fold(b)))).map((c) => [c, counts[c]]);
  }

  _step1() {
    const t = this._t, d = this._draft, panels = this._data.panels;
    const panel = this._panelOf(d.device);
    const cats = this._cats(panel);
    if (!this._cat || !cats.some(([c]) => c === this._cat)) this._cat = cats.length ? cats[0][0] : null;
    const sel = panels.length > 1
      ? `<label class="field">${t.panel}<select id="panelsel">${panels.map((p) => `<option value="${esc(p.device_id)}" ${p.device_id === panel.device_id ? "selected" : ""}>${esc(p.title)}</option>`).join("")}</select></label>` : "";
    const chips = cats.map(([c, n]) => `<button class="chip ${c === this._cat && !this._q ? "on" : ""}" data-a="cat" data-c="${esc(c)}">${esc(c)} · ${n}</button>`).join("");
    return `<h2>1. ${t.s1}</h2><p class="help">${t.s1_help}</p>${sel}
      <div class="bar"><input type="search" id="gsearch" class="grow" placeholder="${esc(t.search)}" value="${esc(this._q)}"></div>
      <div class="chips">${chips}</div><div class="grid" id="grid"></div>`;
  }

  _renderGrid() {
    const t = this._t, d = this._draft, grid = this.shadowRoot.getElementById("grid");
    if (!grid) return;
    const panel = this._panelOf(d.device);
    const q = fold(this._q.trim());
    const list = q ? panel.gifs.filter((g) => fold(g).includes(q)) : panel.gifs.filter((g) => g.split("/")[0] === this._cat);
    const none = `<button class="tile ${d.gif ? "" : "on"}" data-a="gif" data-gif=""><div class="scr">${esc(t.no_gif)}</div><span class="n">—</span></button>`;
    grid.innerHTML = none + (list.map((g) => `<button class="tile ${g === d.gif ? "on" : ""}" data-a="gif" data-gif="${esc(g)}" title="${esc(g)}">
      ${this._screen(d.device, g)}<span class="n">${esc(q ? g.replace(/\.gif$/i, "") : gifLabel(g))}</span></button>`).join("")
      || `<p class="muted">${t.nothing}</p>`);
    this._observe();
    if (this._scrollSel) {       // modification d'une alerte : montrer la GIF choisie
      this._scrollSel = false;
      const sel = grid.querySelector(".tile.on");
      if (sel && sel.dataset.gif) sel.scrollIntoView({ block: "center" });
    }
  }

  _step2() {
    const t = this._t, d = this._draft;
    d.entities = d.entities.filter((e) => this._hass.states[e]);
    const head = `<h2>2. ${t.s2}</h2><p class="help">${t.s2_help}</p>`;
    const search = `<input type="search" id="esearch" style="width:100%" placeholder="${esc(t.e_search)}" value="${esc(this._eq)}">
      <div class="elist" id="elist"></div>`;
    if (!d.entities.length) return head + search;

    const sels = d.entities.map((e) => `<div class="sel"><div class="grow"><b>${esc(this._name(e))}</b><br>
      <small>${esc(e)} · ${esc(fmt(t.now, this._state(e, this._hass.states[e].state)))}</small></div>
      <button data-a="unentity" data-e="${esc(e)}">${t.remove}</button></div>`).join("");
    const first = d.entities[0], so = this._hass.states[first];
    const domain = first.split(".")[0];
    let opts = STATES[domain] || [];
    if ((domain === "input_select" || domain === "select") && Array.isArray(so.attributes.options)) opts = so.attributes.options;
    const isOther = d.to !== null && !opts.includes(d.to);
    const chips = [`<button class="chip ${d.to === null ? "on" : ""}" data-a="to" data-v="">${t.any}</button>`]
      .concat(opts.map((v) => `<button class="chip ${d.to === v ? "on" : ""}" data-a="to" data-v="${esc(v)}">${esc(this._state(first, v))}</button>`))
      .concat([`<button class="chip ${isOther || this._other ? "on" : ""}" data-a="other">${t.other}</button>`]).join("");
    const other = isOther || this._other
      ? `<div class="bar"><input type="text" id="otherv" class="grow" value="${esc(isOther ? d.to : "")}" placeholder="${esc(so.state)}"></div>` : "";
    const add = this._adding ? search : `<button class="link" data-a="addentity">${t.add_entity}</button>`;
    return `${head}<div class="sels">${sels}</div>${add}
      <h3>${d.entities.length > 1 ? t.when_n : t.when}</h3><div class="chips">${chips}</div>${other}`;
  }

  _renderEntities() {
    const t = this._t, d = this._draft, box = this.shadowRoot.getElementById("elist");
    if (!box) return;
    const q = fold(this._eq.trim());
    let list = Object.values(this._hass.states).filter((s) => !s.entity_id.startsWith("automation.")
      && !s.entity_id.startsWith("update.") && !d.entities.includes(s.entity_id));
    if (q) list = list.filter((s) => fold(s.attributes.friendly_name).includes(q) || fold(s.entity_id).includes(q));
    else list = list.filter((s) => SUGGESTED.includes(s.entity_id.split(".")[0]));
    list = list.sort((a, b) => fold(a.attributes.friendly_name || a.entity_id).localeCompare(fold(b.attributes.friendly_name || b.entity_id))).slice(0, 60);
    box.innerHTML = (q ? "" : `<small class="muted">${t.e_suggest}</small>`)
      + (list.map((s) => `<button class="erow" data-a="entity" data-e="${esc(s.entity_id)}"><b>${esc(s.attributes.friendly_name || s.entity_id)}</b>
        <small>${esc(s.entity_id)} · ${esc(this._state(s.entity_id, s.state))}</small></button>`).join("") || `<p class="muted">${t.e_none}</p>`);
  }

  _step3() {
    const t = this._t, d = this._draft;
    const sw = Object.entries(COLORS).map(([k, c]) => `<button class="sw ${d.color === k ? "on" : ""}" data-a="color" data-c="${k}" title="${esc(t.colors[k])}" style="background:${c}"></button>`).join("");
    const eff = EFFECTS.map((e) => `<option value="${e}" ${d.effect === e ? "selected" : ""}>${esc(t.effects[e])}</option>`).join("");
    const num = (sel, max) => `<option value="">${t.dflt}</option>` + Array.from({ length: max }, (_, i) => `<option ${sel === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("");
    const inserts = d.entities.length === 1
      ? `<button data-a="insert" data-k="value1">${esc(fmt(t.insert, this._name(d.entities[0])))}</button>`
      : d.entities.length > 1
        ? `<button data-a="insert" data-k="name">${t.insert_name}</button><button data-a="insert" data-k="value">${t.insert_value}</button>` : "";
    return `<h2>3. ${t.s3}</h2><p class="help">${t.s3_help}</p>
      <label class="field">${t.text}<input type="text" id="msg" maxlength="200" value="${esc(d.message)}" placeholder="${esc(t.text_ph)}"></label>
      <div class="bar">${inserts}</div>
      <label class="field">${t.color} : <span id="cname">${esc(t.colors[d.color] || d.color)}</span></label>
      <div class="swatches" style="margin-top:8px">${sw}</div>
      <div class="cols">
        <label class="field">${t.effect}<select id="effect">${eff}</select></label>
        <label class="field">${t.speed}<select id="speed">${num(d.speed, 10)}</select></label>
        <label class="field" title="${esc(t.passes_help)}">${t.passes} (${t.passes_help})<select id="passes">${num(d.passes, 5)}</select></label>
      </div>
      <div class="preview">${this._screen(d.device, d.gif, "screen")}
        <div class="screen" id="pv">${this._marquee()}</div></div>
      <div class="bar"><button class="primary" data-a="test">▶ ${t.test_btn}</button></div>`;
  }

  // texte de l'apercu : les modeles {{ ... }} remplaces par les valeurs actuelles
  _sample(msg, d = this._draft) {
    const first = d.entities[0];
    return msg.replace(/\{\{(.*?)\}\}/g, (m, inner) => {
      const fixed = inner.match(/states\(\s*'([^']+)'/);
      if (fixed) return this._value(fixed[1]);
      if (/to_state\.name/.test(inner)) return this._name(first);
      if (/trigger\.entity_id/.test(inner)) return this._value(first);
      return "…";
    });
  }

  _marquee() {
    const d = this._draft;
    if (!d.message) return "";
    const c = COLORS[d.color] || "#fff";
    const style = c.startsWith("linear") ? `background:${c};-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${c}`;
    return `<div class="marquee ${d.priority ? "blink" : ""}" style="${style}">${esc(this._sample(d.message))}</div>`;
  }

  // valeur arrondie avec son unite ; virgule decimale dans les langues qui l'utilisent
  _valueTemplate(expr) {
    const comma = (1.5).toLocaleString(this._hass.language).includes(",");
    return `{{ states(${expr}, rounded=True, with_unit=True)${comma ? " | replace('.', ',')" : ""} }}`;
  }

  _step4() {
    const t = this._t, d = this._draft;
    // nom propose : "Entite – Etat" ; suit le declencheur tant que l'utilisateur n'a pas ecrit le sien
    const auto = this._autoName(d);
    if (!d.name || d.name === d.autoName || d.name === this._names(d)) d.name = auto;
    d.autoName = auto;
    const panels = this._data.panels;
    const mins = (list, sel, zero) => list.map((m) => `<option value="${m}" ${sel === m ? "selected" : ""}>${m ? fmt(t.minutes, m) : zero}</option>`).join("");
    const prio = d.priority;
    return `<h2>4. ${t.s4}</h2>
      <label class="field">${t.name}<input type="text" id="aname" value="${esc(d.name)}"></label>
      <h3>${t.opts}</h3>
      <div class="opt ${d.quiet && !prio ? "" : "off"}">
        <label class="lead"><input type="checkbox" id="quiet" ${d.quiet ? "checked" : ""} ${prio ? "disabled" : ""}>${t.quiet}</label>
        <input type="time" id="qfrom" value="${esc(d.quietFrom)}" ${d.quiet && !prio ? "" : "disabled"}> ${t.to_h}
        <input type="time" id="qto" value="${esc(d.quietTo)}" ${d.quiet && !prio ? "" : "disabled"}>
      </div>
      <div class="opt ${prio ? "off" : ""}">
        <span class="lead">${t.cooldown}</span>
        <select id="cooldown" ${prio ? "disabled" : ""}>${mins(COOLDOWNS, d.cooldown, t.no_limit)}</select>
      </div>
      <div class="opt">
        <label class="lead"><input type="checkbox" id="prio" ${prio ? "checked" : ""}><b>${t.prio}</b></label>
        ${prio ? `<span>${t.repeat}</span><select id="repeat">${mins(REPEATS, d.repeat, t.no_repeat)}</select>` : ""}
        <small>${t.prio_help}</small>
      </div>
      <div class="preview">${this._screen(d.device, d.gif, "screen")}</div>
      <dl class="sum">
        ${panels.length > 1 ? `<dt>${t.sum_panel}</dt><dd>${esc(this._panelOf(d.device).title)}</dd>` : ""}
        <dt>${t.sum_gif}</dt><dd>${esc(d.gif || "—")}</dd>
        <dt>${t.sum_when}</dt><dd>${esc(this._whenText(d))}</dd>
        <dt>${t.sum_text}</dt><dd>${esc(d.message ? this._sample(d.message) : "—")}</dd>
        <dt>${t.color}</dt><dd>${esc(t.colors[d.color] || d.color)} · ${esc(t.effects[d.effect] || d.effect)}</dd>
      </dl>`;
  }

  // ---------- donnees ----------

  _newDraft() {
    return { id: null, device: this._data.panels[0].device_id, gif: "", entities: [], to: null, message: "",
      color: "blanc", effect: "defile", speed: null, passes: null, name: "",
      quiet: false, quietFrom: "23:00", quietTo: "07:00", cooldown: 0, priority: false, repeat: 0 };
  }

  _findNotify(list) {
    for (const a of [].concat(list || [])) {
      if (a && a.action === "orbitdmd.notify") return a;
      const inner = a && a.repeat && this._findNotify(a.repeat.sequence);
      if (inner) return inner;
    }
    return null;
  }

  _parse(cfg) {
    const tr = [].concat(cfg.triggers || cfg.trigger || [])[0] || {};
    const ac = this._findNotify(cfg.actions || cfg.action) || {};
    const d = ac.data || {};
    const meta = (cfg.variables && cfg.variables.orbitdmd) || {};
    const one = (v) => (Array.isArray(v) ? v[0] : v);
    const o = {
      id: cfg.id, name: String(cfg.alias || "").replace(/^OrbitDMD\s*[–-]\s*/, ""),
      entities: [].concat(tr.entity_id || []), to: tr.to === undefined || tr.to === null ? null : String(tr.to),
      device: one(d.device_id) || this._data.panels[0].device_id, gif: d.gif || "", message: d.message || "",
      color: d.color || "blanc", effect: d.effect || "defile",
      speed: d.speed ? Number(d.speed) : null, passes: d.passes ? Number(d.passes) : null,
      quiet: !!meta.quiet, quietFrom: hhmm(meta.quiet_from, "23:00"), quietTo: hhmm(meta.quiet_to, "07:00"),
      cooldown: Number(meta.cooldown) || 0, priority: meta.priority !== undefined ? !!meta.priority : !!d.blink,
      repeat: Number(meta.repeat) || 0,
    };
    o.autoName = this._autoName(o);     // un nom propose garde le suivi si l'etat change
    return o;
  }

  _notifyData(d) {
    const data = { device_id: [d.device] };
    if (d.gif) data.gif = d.gif;
    if (d.message) data.message = d.message;
    data.color = d.color;
    data.effect = d.effect;
    if (d.speed) data.speed = d.speed;
    if (d.passes) data.passes = d.passes;
    if (d.priority) data.blink = true;
    return data;
  }

  _config(d) {
    const trigger = { trigger: "state", entity_id: d.entities.length === 1 ? d.entities[0] : d.entities.slice(), not_from: ["unavailable"] };
    if (d.to === null) trigger.not_to = ["unavailable", "unknown"];   // tout changement d'etat (pas les attributs)
    else trigger.to = d.to;
    const notify = { action: "orbitdmd.notify", data: this._notifyData(d) };
    const repeat = d.priority && d.repeat > 0;
    const cooldown = !d.priority && d.cooldown > 0;
    let actions;
    if (repeat) {
      // alerte prioritaire : se repete tant que l'entite garde l'etat qui l'a declenchee
      actions = [{ repeat: {
        while: [{ condition: "template",
          value_template: `{{ repeat.index <= ${MAX_REPEATS} and is_state(trigger.entity_id, trigger.to_state.state) }}` }],
        sequence: [notify, { delay: { minutes: d.repeat } }] } }];
    } else {
      // anti-repetition : l'automatisation reste "occupee" pendant le delai, les declenchements sont ignores
      actions = cooldown ? [notify, { delay: { minutes: d.cooldown } }] : [notify];
    }
    const conditions = d.quiet && !d.priority
      ? [{ condition: "not", conditions: [{ condition: "time", after: `${d.quietFrom}:00`, before: `${d.quietTo}:00` }] }] : [];
    const cfg = {
      id: d.id, alias: `OrbitDMD – ${d.name}`, description: this._t.description,
      variables: { orbitdmd: { quiet: d.quiet, quiet_from: d.quietFrom, quiet_to: d.quietTo,
        cooldown: d.cooldown, priority: d.priority, repeat: d.repeat } },
      triggers: [trigger], conditions, actions,
    };
    if (repeat || cooldown) { cfg.mode = "single"; cfg.max_exceeded = "silent"; }
    else { cfg.mode = "queued"; cfg.max = 5; }
    return cfg;
  }

  async _send(d) {
    const data = this._notifyData(d);
    const first = d.entities[0];
    const so = first && this._hass.states[first];
    try {
      // execute_script calcule les modeles {{ ... }} comme le ferait l'automatisation ;
      // "trigger" est imite avec la premiere entite
      const variables = so ? { trigger: { entity_id: first, to_state: { name: this._name(first), state: so.state } } } : {};
      await this._hass.callWS({ type: "execute_script", sequence: [{ action: "orbitdmd.notify", data }], variables });
      this._toast(this._t.sent);
    } catch (err) {
      try {   // Home Assistant ancien (pas de "variables") : texte d'exemple a la place des modeles
        if (data.message) data.message = this._sample(data.message, d);
        await this._hass.callWS({ type: "execute_script", sequence: [{ action: "orbitdmd.notify", data }] });
        this._toast(this._t.sent);
      } catch (err2) {
        this._toast(fmt(this._t.error, err2.message || err2.code || err2));
      }
    }
  }

  _go(view) {
    this._view = view;
    this._confirm = null;
    this._adding = false;
    this._render();
    window.scrollTo(0, 0);
  }

  _openDraft(draft, view) {
    this._draft = draft;
    this._q = ""; this._eq = ""; this._other = false;
    this._cat = (draft.gif || "").split("/")[0] || null;
    this._go(view);
  }

  // ---------- actions ----------

  async _click(e) {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const t = this._t, d = this._draft, a = b.dataset.a;
    if (a !== "del") this._confirm = null;
    switch (a) {
      case "new": this._openDraft(this._newDraft(), 1); break;
      case "edit": this._openDraft(this._parse(this._configs[b.dataset.id]), 1); this._scrollSel = true; this._renderGrid(); break;
      case "dup": {   // copie : meme panneau, GIF, entites et message ; on change l'etat (ex. ON -> OFF)
        const copy = this._parse(this._configs[b.dataset.id]);
        copy.id = null; copy.name = "";
        this._openDraft(copy, 2);
        this._toast(t.dup_toast);
        break;
      }
      case "testauto": await this._send(this._parse(this._configs[b.dataset.id])); break;
      case "toggle": await this._hass.callService("automation", b.checked ? "turn_on" : "turn_off", { entity_id: b.dataset.e }); break;
      case "del":
        if (this._confirm !== b.dataset.id) { this._confirm = b.dataset.id; this._render(); break; }
        try {
          await this._hass.callApi("DELETE", `config/automation/config/${b.dataset.id}`);
          delete this._configs[b.dataset.id];
          this._toast(t.deleted);
        } catch (err) { this._toast(fmt(t.error, err.message || err)); }
        this._confirm = null; this._render(); break;
      case "cat": this._cat = b.dataset.c; this._q = ""; this._render(); break;
      case "gif":
        d.gif = b.dataset.gif;
        this.shadowRoot.querySelectorAll(".tile").forEach((x) => x.classList.toggle("on", x.dataset.gif === d.gif));
        break;
      case "entity":
        if (!d.entities.includes(b.dataset.e)) d.entities.push(b.dataset.e);
        if (d.entities.length === 1) { d.to = null; this._other = false; }
        this._adding = false; this._eq = ""; this._render(); break;
      case "unentity": d.entities = d.entities.filter((x) => x !== b.dataset.e); if (!d.entities.length) d.to = null; this._render(); break;
      case "addentity": this._adding = true; this._render(); { const i = this.shadowRoot.getElementById("esearch"); if (i) i.focus(); } break;
      case "to": d.to = b.dataset.v === "" ? null : b.dataset.v; this._other = false; this._render(); break;
      case "other": this._other = true; this._render(); { const i = this.shadowRoot.getElementById("otherv"); if (i) i.focus(); } break;
      case "color":
        d.color = b.dataset.c;
        this.shadowRoot.querySelectorAll(".sw").forEach((x) => x.classList.toggle("on", x.dataset.c === d.color));
        this.shadowRoot.getElementById("cname").textContent = t.colors[d.color] || d.color;
        this.shadowRoot.getElementById("pv").innerHTML = this._marquee();
        break;
      case "insert": {
        const k = b.dataset.k;
        const tpl = k === "name" ? "{{ trigger.to_state.name }}"
          : k === "value" ? this._valueTemplate("trigger.entity_id") : this._valueTemplate(`'${d.entities[0]}'`);
        d.message = `${d.message}${d.message ? " " : ""}${tpl}`;
        const i = this.shadowRoot.getElementById("msg"); i.value = d.message; i.focus();
        this.shadowRoot.getElementById("pv").innerHTML = this._marquee();
        break;
      }
      case "test":
        if (!d.gif && !d.message) { this._toast(t.need_content); break; }
        await this._send(d); break;
      case "goto": this._go(Number(b.dataset.s)); break;
      case "back": this._go(this._view === 1 ? "home" : this._view - 1); break;
      case "next":
        if (this._view === 2 && !d.entities.length) { this._toast(t.need_entity); break; }
        if (this._view === 3 && !d.gif && !d.message) { this._toast(t.need_content); break; }
        this._go(this._view + 1); break;
      case "save": {
        d.name = (d.name || "").trim();
        if (!d.name) { this._toast(t.need_name); break; }
        if (!d.entities.length) { this._toast(t.need_entity); this._go(2); break; }
        if (!d.gif && !d.message) { this._toast(t.need_content); this._go(3); break; }
        if (!d.id) d.id = `orbitdmd_${Date.now()}`;
        const cfg = this._config(d);
        try {
          await this._hass.callApi("POST", `config/automation/config/${d.id}`, cfg);
          this._configs[d.id] = cfg;
          this._toast(t.saved);
          this._go("home");
          this._categorizeId(d.id);
        } catch (err) { this._toast(fmt(t.error, err.message || err.body?.message || err)); }
        break;
      }
    }
  }

  _input(e) {
    const el = e.target, d = this._draft;
    if (!el.id) return;
    // "change" arrive quand le champ perd le focus, juste avant le clic : ne rien redessiner a ce moment-la,
    // sinon l'element clique disparait et le clic est perdu
    if (e.type === "change" && el.id !== "panelsel") return;
    switch (el.id) {
      case "gsearch":
        this._q = el.value;
        this.shadowRoot.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", !this._q && c.dataset.c === this._cat));
        this._renderGrid(); break;
      case "esearch": this._eq = el.value; this._renderEntities(); break;
      case "panelsel": d.device = el.value; d.gif = ""; this._render(); break;
      case "otherv": d.to = el.value.trim() === "" ? null : el.value.trim(); break;
      case "msg": d.message = el.value; this.shadowRoot.getElementById("pv").innerHTML = this._marquee(); break;
      case "effect": d.effect = el.value; break;
      case "speed": d.speed = el.value ? Number(el.value) : null; break;
      case "passes": d.passes = el.value ? Number(el.value) : null; break;
      case "aname": d.name = el.value; break;
      case "quiet": d.quiet = el.checked; this._render(); break;
      case "qfrom": if (el.value) d.quietFrom = el.value.slice(0, 5); break;
      case "qto": if (el.value) d.quietTo = el.value.slice(0, 5); break;
      case "cooldown": d.cooldown = Number(el.value) || 0; break;
      case "repeat": d.repeat = Number(el.value) || 0; break;
      case "prio":
        d.priority = el.checked;
        if (d.priority && d.color === "blanc") d.color = "rouge";     // prioritaire : rouge par defaut
        this._render(); break;
    }
  }

  _toast(msg) {
    const el = this.shadowRoot.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.remove("show"), 3500);
  }

  // ---------- vignettes (chargees quand elles deviennent visibles, 3 a la fois) ----------

  _observe() {
    if (!this._io) {
      this._io = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) { this._io.unobserve(en.target); this._loadThumb(en.target); }
      }, { rootMargin: "300px" });
    }
    this.shadowRoot.querySelectorAll("img.gif:not([src])").forEach((img) => {
      const url = this._thumbs.get(`${img.dataset.entry}|${img.dataset.gif}`);
      if (url) img.src = url; else this._io.observe(img);
    });
  }

  _loadThumb(img) {
    const key = `${img.dataset.entry}|${img.dataset.gif}`;
    const url = this._thumbs.get(key);
    if (url) { img.src = url; return; }
    let w = this._waiting.get(key);
    if (!w) { w = []; this._waiting.set(key, w); this._queue.push(key); }
    w.push(img);
    this._pump();
  }

  _pump() {
    while (this._active < 3 && this._queue.length) {
      const key = this._queue.shift();
      const [entry, gif] = [key.slice(0, key.indexOf("|")), key.slice(key.indexOf("|") + 1)];
      const cat = gif.split("/")[0], name = gif.split("/").slice(1).join("/");
      this._active++;
      this._hass.fetchWithAuth(`/api/orbitdmd/gif/${encodeURIComponent(entry)}/${encodeURIComponent(cat)}/${encodeURIComponent(name)}`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
        .then((blob) => {
          const u = URL.createObjectURL(blob);
          this._thumbs.set(key, u);
          (this._waiting.get(key) || []).forEach((i) => { i.src = u; });
          this.shadowRoot.querySelectorAll("img.gif:not([src])").forEach((i) => { if (`${i.dataset.entry}|${i.dataset.gif}` === key) i.src = u; });
        })
        .catch(() => {})
        .finally(() => { this._waiting.delete(key); this._active--; this._pump(); });
    }
  }
}

// une nouvelle version peut etre chargee dans un onglet qui avait deja l'ancienne
if (!customElements.get("orbitdmd-panel")) customElements.define("orbitdmd-panel", OrbitDMDPanel);
