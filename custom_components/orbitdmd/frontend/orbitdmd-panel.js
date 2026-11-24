// Page "OrbitDMD" de Home Assistant : alertes du panneau, creees pas a pas.
// 1. GIF (vignettes animees)  2. declencheur (une ou plusieurs entites + etat)  3. message
// 4. options (heures de silence, anti-repetition, priorite) et enregistrement.
// Chaque alerte est une automatisation ordinaire de Home Assistant (id "orbitdmd_...", categorie
// "OrbitDMD") qui appelle l'action orbitdmd.notify : elle reste visible dans Automatisations.
// Les reglages de l'assistant sont gardes dans variables.orbitdmd de l'automatisation.

// textes en 12 langues : orbitdmd-i18n.js (meme empreinte "?v=" que ce fichier, pour le cache)
const { pickLanguage } = await import(new URL(`./orbitdmd-i18n.js${new URL(import.meta.url).search}`, import.meta.url).href);
// alertes Alexa (minuteurs, rappels, alarmes) : orbitdmd-alexa.js
const AX = await import(new URL(`./orbitdmd-alexa.js${new URL(import.meta.url).search}`, import.meta.url).href);

const EFFECTS = ["defile", "inverse", "monte", "descend", "lettres", "pluie", "fondu"];
const PAGED = ["monte", "descend", "lettres", "pluie", "fondu"];   // texte en pages (les autres defilent)
const SIZES = [8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32];        // taille du texte en pixels du panneau
const PIXEL = "Pixel";
const PIXEL_FAMILY = "odmd-pixel";                               // police Pixel du panneau, en police web
const ICON_WIDTH = 32;
const LINE_GAP = 2;                                              // pixels entre les deux lignes d'une page                                           // largeur habituelle d'une icone (pixels)                                           // police 5x7 integree au panneau
const DEFAULT_SPEED = 4;                                         // vitesse des notifications du panneau
// nom lisible d'une police ("BlackOpsOne.ttf" -> "Black Ops One"), comme la page Horloge du panneau
const FONT_NAMES = { pressstart2p: "Press Start 2P", vt323: "VT323", blackopsone: "Black Ops One", russoone: "Russo One",
  mountainsofchristmas: "Mountains of Christmas", "orbitdmd-led": "OrbitDMD LED", "orbitdmd-gras": "OrbitDMD Gras",
  "orbitdmd-segments": "OrbitDMD 7 segments", goudysto: "Goudy Stout" };
const fontLabel = (f) => {
  const base = f.replace(/^.*\//, "").replace(/\.(ttf|otf)$/i, "");
  return FONT_NAMES[base.toLowerCase()] || base.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
};
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
const ICON_CATEGORY = "Icones";   // petites GIF a gauche du texte (panneau 1.7.0+)
const MAX_REPEATS = 30;
const FOR_MINUTES = [0, 1, 2, 5, 10, 15, 30, 60];          // "pendant au moins"
const SUN_OFFSETS = [-120, -60, -30, -15, 0, 15, 30, 60, 120];   // minutes avant (-) ou apres (+)
const CAL_OFFSETS = [0, 5, 15, 30, 60, 120, 180, 720, 1440];           // minutes avant l'evenement
const ENTITY_TRIGS = ["entity", "value"];
// "a intervalle regulier" : en minutes (moins de 60 : X fois par heure ; sinon toutes les X heures)
const PERIODS = [10, 15, 20, 30, 60, 120, 180, 240, 360, 720];                    // declencheurs bases sur des entites
// minutes -> "01:30:00" (ou "-00:30:00") pour Home Assistant, et retour
const hms = (min) => `${min < 0 ? "-" : ""}${String(Math.floor(Math.abs(min) / 60)).padStart(2, "0")}:${String(Math.abs(min) % 60).padStart(2, "0")}:00`;
const fromHms = (v) => {
  if (typeof v === "number") return v;
  const m = String(v || "").match(/^(-?)(\d+):(\d+)/);
  return m ? (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
};
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];   // cles des jours dans Home Assistant
// numero de semaine ISO (comme now().isocalendar()[1] dans Home Assistant)
const isoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};      // une alerte prioritaire se repete 30 fois au plus

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// images d'une GIF (RGBA), avec ses etapes d'animation : decodeur de la page GIF du panneau
// (dmd/web/gifscale.js, verifie identique a Pillow) ; ImageDecoder n'existe pas en http
const GifFrames = {
	/* --- decodage : images completes (RGBA) apres chaque etape de l'animation --- */
	decode (bytes) {
		let p = 13;
		const W = bytes[6] | bytes[7] << 8, H = bytes[8] | bytes[9] << 8, flags = bytes[10];
		const readTable = n => { const t = bytes.subarray(p, p + n * 3); p += n * 3; return t; };
		const global = flags & 0x80 ? readTable(1 << ((flags & 7) + 1)) : null;
		const canvas = new Uint8ClampedArray(W * H * 4);	/* fond transparent */
		const frames = [];
		let gce = { disposal: 0, transparent: -1, delay: 10 };

		while (p < bytes.length) {
			const b = bytes[p++];
			if (b === 0x3B) break;
			if (b === 0x21) {
				const label = bytes[p++];
				if (label === 0xF9 && bytes[p] >= 4) {
					const f = bytes[p + 1];
					gce = { disposal: f >> 2 & 7, transparent: f & 1 ? bytes[p + 4] : -1, delay: bytes[p + 2] | bytes[p + 3] << 8 };
				}
				while (bytes[p]) p += bytes[p] + 1;	/* sous-blocs */
				p++;
				continue;
			}
			if (b !== 0x2C) throw new Error("GIF illisible");

			const x0 = bytes[p] | bytes[p + 1] << 8, y0 = bytes[p + 2] | bytes[p + 3] << 8;
			const fw = bytes[p + 4] | bytes[p + 5] << 8, fh = bytes[p + 6] | bytes[p + 7] << 8, ff = bytes[p + 8];
			p += 9;
			const table = ff & 0x80 ? readTable(1 << ((ff & 7) + 1)) : global;
			if (!table) throw new Error("GIF sans palette");
			const minCode = bytes[p++];
			/* donnees : sous-blocs mis bout a bout */
			let len = 0, q = p;
			while (bytes[q]) { len += bytes[q]; q += bytes[q] + 1; }
			const data = new Uint8Array(len);
			for (let o = 0; bytes[p]; p += bytes[p] + 1) { data.set(bytes.subarray(p + 1, p + 1 + bytes[p]), o); o += bytes[p]; }
			p++;
			const pixels = GifFrames.lzwDecode(data, minCode, fw * fh);

			const previous = gce.disposal === 3 ? canvas.slice() : null;
			/* lignes entrelacees : ordre 0,8,16.. 4,12.. 2,6.. 1,3.. */
			const rows = [];
			if (ff & 0x40) { for (const [s, d] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = s; y < fh; y += d) rows.push(y); }
			else for (let y = 0; y < fh; y++) rows.push(y);
			for (let r = 0; r < fh; r++) {
				const y = y0 + rows[r];
				if (y >= H) continue;
				for (let x = 0; x < fw; x++) {
					const idx = pixels[r * fw + x];
					if (idx === gce.transparent || x0 + x >= W) continue;
					const o = (y * W + x0 + x) * 4;
					canvas[o] = table[idx * 3]; canvas[o + 1] = table[idx * 3 + 1]; canvas[o + 2] = table[idx * 3 + 2]; canvas[o + 3] = 255;
				}
			}
			frames.push({ rgba: canvas.slice(), delay: gce.delay });

			if (gce.disposal === 2) {
				for (let y = y0; y < Math.min(H, y0 + fh); y++) canvas.fill(0, (y * W + x0) * 4, (y * W + Math.min(W, x0 + fw)) * 4);
			} else if (gce.disposal === 3 && previous) canvas.set(previous);
			gce = { disposal: 0, transparent: -1, delay: 10 };
		}
		if (!frames.length) throw new Error("GIF sans image");
		return { w: W, h: H, frames };
	},

	lzwDecode (data, minCode, count) {
		const out = new Uint8Array(count);
		const clear = 1 << minCode, end = clear + 1;
		const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096);
		const stack = new Uint8Array(4097);
		for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; first[i] = i; }
		let size = minCode + 1, next = end + 1, old = -1, bits = 0, acc = 0, n = 0, pos = 0;
		while (n < count) {
			while (bits < size && pos < data.length) { acc |= data[pos++] << bits; bits += 8; }
			if (bits < size) break;
			const code = acc & ((1 << size) - 1);
			acc >>>= size; bits -= size;
			if (code === clear) { size = minCode + 1; next = end + 1; old = -1; continue; }
			if (code === end) break;
			let c = code, sp = 0;
			if (old === -1) { if (code >= clear) break; out[n++] = code; old = code; continue; }
			if (code >= next) { stack[sp++] = first[old]; c = old; }	/* code pas encore connu */
			while (c >= clear) { stack[sp++] = suffix[c]; c = prefix[c]; }
			stack[sp++] = c;
			if (next < 4096) { prefix[next] = old; suffix[next] = c; first[next] = first[old]; next++; }
			while (sp && n < count) out[n++] = stack[--sp];
			if (next === 1 << size && size < 12) size++;
			old = code;
		}
		return out;
	}
};

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
input[type=text], input[type=search], input[type=time], input[type=number], select { font:inherit; color:var(--primary-text-color); background:var(--secondary-background-color, transparent);
  border:1px solid var(--divider-color); border-radius:8px; padding:9px 12px; box-sizing:border-box; }
input[type=text]:focus, input[type=search]:focus, input[type=time]:focus, input[type=number]:focus, select:focus { outline:2px solid var(--primary-color); border-color:transparent; }
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
.pvicon { position:absolute; left:0; top:0; bottom:0; aspect-ratio:1; background:#000; z-index:1; }
.icobox { width:100%; height:100%; }
.icons { display:flex; gap:8px; flex-wrap:wrap; }
.ico { width:64px; height:64px; padding:4px; background:#000; color:#999; font-size:12px; display:flex; align-items:center;
  justify-content:center; border:2px solid var(--divider-color); }
.ico.on { border-color:var(--primary-color); outline:2px solid var(--primary-color); }
.screen { container-type:size; }
/* texte de l'apercu : 100cqh = hauteur du panneau (32 pixels) ; l'animation est posee par _marquee() */
.pvtext, .blinker { position:absolute; inset:0; }
.blinker { animation:bl .7s step-end infinite; }
.marquee { position:absolute; left:0; top:0; bottom:0; display:flex; align-items:center; white-space:nowrap; line-height:1; }
.marquee.page { right:0; display:grid; place-items:center; overflow:hidden; }
.marquee.page > .t { grid-area:1/1; }
.marquee .t, .marquee .l { display:inline-block; white-space:pre; }
@keyframes mq { from { transform:translateX(100cqw); } to { transform:translateX(-100%); } }
@keyframes mqr { from { transform:translateX(-100%); } to { transform:translateX(100cqw); } }
@keyframes bl { 64% { opacity:0; } }
.axdevs { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:8px; }
.axdev { align-items:center; }
.axev { margin-top:10px; display:flex; flex-direction:column; gap:8px; }
.axev label.lead { display:flex; align-items:center; gap:10px; }
.axev.off { opacity:.75; }
.axrow { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.axpv { width:320px; max-width:100%; flex:none; }
.axnew { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
/* menu Alexa : evenements et appareils repliables */
.axhead { display:flex; align-items:center; gap:12px; }
.axhead > .grow { display:flex; flex-direction:column; gap:4px; min-width:0; }
.axmini { width:176px; flex:none; cursor:pointer; }
button.fold { flex:none; width:38px; height:38px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center; }
button.fold svg { fill:none; stroke:currentColor; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; transition:transform .15s; }
button.fold[aria-expanded="true"] svg { transform:rotate(90deg); }
.foldh { display:flex; align-items:center; gap:12px; margin:18px 0 8px; }
.foldh h3 { margin:0; }
.foldh small { flex:1; color:var(--secondary-text-color); }
@media (max-width:600px) { .axmini { width:112px; } }
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
    if ((this._hass.config.components || []).includes("alexa_media")) {
      try { this._axDevices = await AX.alexaDevices(this._hass); } catch (e) { this._axDevices = null; }
    }
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
    main.innerHTML = this._view === "home" ? this._home() : this._view === "alexa" ? this._alexaView() : this._wizard();
    if (this._view === 1) this._renderGrid();
    if (this._view === 2) this._renderEntities();
    this._observe();
    this._tune();
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

  // nom d'un jour dans la langue de Home Assistant (le 1er janvier 2024 est un lundi)
  _dayName(key, form = "long") {
    const i = WEEKDAYS.indexOf(key);
    return new Date(2024, 0, 1 + i).toLocaleDateString(this._hass.language, { weekday: form });
  }

  _timeText(d) {
    const t = this._t;
    const days = d.days.length === 7 ? t.every_day
      : WEEKDAYS.filter((k) => d.days.includes(k)).map((k) => this._dayName(k)).join(", ");
    return fmt(t.when_time, days, d.time) + (d.every === 2 ? t.when_biweekly : "");
  }

  // duree lisible : "30 min", "2 h", "1 jour"
  _dur(m) {
    const t = this._t;
    return m >= 1440 ? fmt(t.days_n, m / 1440) : m >= 60 && m % 60 === 0 ? fmt(t.hours_n, m / 60) : fmt(t.minutes, m);
  }

  _unit(d) {
    const so = this._hass.states[d.entities[0]];
    return (so && so.attributes.unit_of_measurement) || "";
  }

  _whenText(d) {
    const t = this._t;
    const forText = ENTITY_TRIGS.includes(d.trig) && d.forMin ? fmt(t.for_suffix, this._dur(d.forMin)) : "";
    if (d.trig === "time") return this._timeText(d);
    if (d.trig === "periodic") return this._periodText(d.perEvery);
    if (d.trig === "sun") {
      const up = d.sunEvent === "sunrise";
      if (!d.sunOffset) return up ? t.when_sunrise : t.when_sunset;
      const key = `when_${up ? "sunrise" : "sunset"}_${d.sunOffset < 0 ? "before" : "after"}`;
      return fmt(t[key], this._dur(Math.abs(d.sunOffset)));
    }
    if (d.trig === "calendar") {
      const cal = this._name(d.calendar);
      return fmt(d.calEvent === "end" ? t.when_cal_end : t.when_cal_start, cal)
        + (d.calWord.trim() ? fmt(t.cal_word_suffix, d.calWord.trim()) : "")
        + (d.calOffset ? fmt(t.cal_before_suffix, this._dur(d.calOffset)) : "");
    }
    const n = this._names(d);
    if (d.trig === "value") {
      return fmt(d.cmp === "above" ? t.when_above : t.when_below, n, `${d.threshold} ${this._unit(d)}`.trim()) + forText;
    }
    return (d.to === null ? fmt(t.when_any, n) : fmt(t.when_to, n, this._state(d.entities[0], d.to))) + forText;
  }

  // "6 fois par heure (toutes les 10 min)", "Toutes les heures", "Toutes les 2 heures"
  _periodText(m) {
    const t = this._t;
    if (m < 60) return fmt(t.per_hour, 60 / m, m);
    return m === 60 ? t.per_1h : fmt(t.per_nh, m / 60);
  }

  _autoName(d) {
    const what = gifLabel(d.icon && d.mode === "icon" ? d.icon : d.gif) || d.message || "OrbitDMD";
    if (d.trig === "sun" || d.trig === "calendar" || d.trig === "periodic") return `${what} – ${this._whenText(d)}`;
    if (d.trig === "value") {
      return `${d.entities.map((e) => this._name(e)).join(" / ")} – ${d.cmp === "above" ? ">" : "<"} ${d.threshold} ${this._unit(d)}`.trim();
    }
    if (d.trig === "time") {
      const days = d.days.length === 7 ? this._t.every_day
        : WEEKDAYS.filter((k) => d.days.includes(k)).map((k) => this._dayName(k, "short")).join(", ");
      return `${gifLabel(d.icon && d.mode === "icon" ? d.icon : d.gif) || d.message || "OrbitDMD"} – ${days} ${d.time}`;
    }
    const n = d.entities.length ? d.entities.map((e) => this._name(e)).join(" / ") : gifLabel(d.gif);
    return d.entities.length && d.to !== null ? `${n} – ${this._state(d.entities[0], d.to)}` : n;
  }

  _home() {
    const t = this._t;
    const rows = this._autos().map((s) => {
      const cfg = this._configs[s.attributes.id];
      if (cfg && AX.isAlexa(cfg)) return this._alexaRow(s, cfg);
      const d = cfg ? this._parse(cfg) : null;
      const on = s.state === "on";
      const last = s.attributes.last_triggered
        ? fmt(t.last, new Date(s.attributes.last_triggered).toLocaleString(this._hass.language)) : t.never;
      const armed = this._confirm === s.attributes.id;
      const badges = d ? [
        d.priority ? `<span class="badge prio">${t.b_prio}${d.repeat ? " · " + fmt(t.b_repeat, d.repeat) : ""}</span>` : "",
        d.quiet && !d.priority ? `<span class="badge">${esc(fmt(t.b_quiet, d.quietFrom, d.quietTo))}</span>` : "",
        d.cooldown && !d.priority ? `<span class="badge">${esc(fmt(t.b_cool, d.cooldown))}</span>` : "",
        d.mode === "icon" ? `<span class="badge">${t.b_icon}</span>` : "",
      ].join("") : "";
      const id = esc(s.attributes.id);
      return `<div class="card alert ${on ? "" : "off"}">
        ${d && d.message && (d.mode === "icon" || !d.gif)
          // icone + texte (ou texte seul) : le meme apercu anime qu'a l'etape 3
          ? `<div class="screen" style="border-radius:6px">${this._marquee(d)}</div>`
          : this._screen(d && d.device, d && d.gif)}
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
      ${this._axNew().length ? `<div class="banner axnew">${esc(fmt(t.ax_new_device, this._axNew().map((d) => d.name).join(", ")))}
        <button data-a="axadd">${t.ax_add}</button> <button data-a="axignore">${t.ax_ignore}</button></div>` : ""}
      <div class="bar"><button class="primary" data-a="new">+ ${t.new}</button><button data-a="alexa">${t.ax_menu}</button></div>
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
    const kinds = [["entity", t.trig_entity], ["value", t.trig_value], ["time", t.trig_time], ["periodic", t.trig_periodic], ["sun", t.trig_sun], ["calendar", t.trig_calendar]]
      .map(([k, label]) => `<button class="chip ${d.trig === k ? "on" : ""}" data-a="trig" data-v="${k}">${label}</button>`).join("");
    const help = { entity: t.s2_help, value: t.value_help, time: t.time_help, periodic: t.per_help, sun: t.sun_help, calendar: t.cal_help }[d.trig];
    const head = `<h2>2. ${t.s2}</h2><div class="chips">${kinds}</div><p class="help">${help}</p>`;
    if (d.trig === "time") return head + this._timePicker();
    if (d.trig === "sun") return head + this._sunPicker();
    if (d.trig === "calendar") return head + this._calendarPicker();

    const search = `<input type="search" id="esearch" style="width:100%" placeholder="${esc(t.e_search)}" value="${esc(this._eq)}">
      <div class="elist" id="elist"></div>`;
    if (d.trig === "periodic") return head + this._periodPicker(search);
    if (!d.entities.length) return head + search;
    const sels = d.entities.map((e) => `<div class="sel"><div class="grow"><b>${esc(this._name(e))}</b><br>
      <small>${esc(e)} · ${esc(fmt(t.now, this._state(e, this._hass.states[e].state)))}</small></div>
      <button data-a="unentity" data-e="${esc(e)}">${t.remove}</button></div>`).join("");
    const add = this._adding ? search : `<button class="link" data-a="addentity">${t.add_entity}</button>`;
    // "pendant au moins X minutes" : l'etat (ou la valeur) doit durer avant que l'alerte parte
    const forSel = `<div class="opt"><span class="lead">${t.for_label}</span><select id="formin">${FOR_MINUTES.map((m) =>
      `<option value="${m}" ${d.forMin === m ? "selected" : ""}>${m ? this._dur(m) : t.for_now}</option>`).join("")}</select></div>`;

    if (d.trig === "value") {
      const cmp = [["below", t.cmp_below], ["above", t.cmp_above]]
        .map(([k, label]) => `<button class="chip ${d.cmp === k ? "on" : ""}" data-a="cmp" data-v="${k}">${label}</button>`).join("");
      return `${head}<div class="sels">${sels}</div>${add}
        <h3>${d.entities.length > 1 ? t.when_n : t.when}</h3><div class="chips">${cmp}</div>
        <div class="bar"><input type="number" step="any" id="threshold" value="${esc(d.threshold)}" placeholder="0" style="width:140px">
          <span>${esc(this._unit(d))}</span></div>${forSel}`;
    }

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
    return `${head}<div class="sels">${sels}</div>${add}
      <h3>${d.entities.length > 1 ? t.when_n : t.when}</h3><div class="chips">${chips}</div>${other}${forSel}`;
  }

  // "a intervalle regulier" : la frequence, et des valeurs a montrer (facultatif)
  _periodPicker(search) {
    const t = this._t, d = this._draft;
    const opts = PERIODS.map((m) => `<option value="${m}" ${d.perEvery === m ? "selected" : ""}>${esc(this._periodText(m))}</option>`).join("");
    const sels = d.entities.map((e) => `<div class="sel"><div class="grow"><b>${esc(this._name(e))}</b><br>
      <small>${esc(e)} · ${esc(fmt(t.now, this._state(e, this._hass.states[e].state)))}</small></div>
      <button data-a="unentity" data-e="${esc(e)}">${t.remove}</button></div>`).join("");
    const add = !d.entities.length || this._adding ? search : `<button class="link" data-a="addentity">${t.add_entity}</button>`;
    return `<div class="cols"><label class="field">${t.per_label}<select id="perevery">${opts}</select></label></div>
      <h3>${t.per_values}</h3><p class="help">${t.per_values_help}</p><div class="sels">${sels}</div>${add}`;
  }

  // "au lever ou au coucher du soleil", avec un decalage
  _sunPicker() {
    const t = this._t, d = this._draft;
    const ev = [["sunrise", t.sunrise], ["sunset", t.sunset]]
      .map(([k, label]) => `<button class="chip ${d.sunEvent === k ? "on" : ""}" data-a="sunev" data-v="${k}">${label}</button>`).join("");
    const off = SUN_OFFSETS.map((m) => `<option value="${m}" ${d.sunOffset === m ? "selected" : ""}>${
      m === 0 ? t.at_exact : fmt(m < 0 ? t.min_before : t.min_after, this._dur(Math.abs(m)))}</option>`).join("");
    return `<div class="chips">${ev}</div>
      <div class="cols"><label class="field">${t.offset}<select id="sunoff">${off}</select></label></div>`;
  }

  // "evenement d'agenda" : agenda, debut ou fin, un peu avant, mot dans le titre
  _calendarPicker() {
    const t = this._t, d = this._draft;
    const cals = Object.values(this._hass.states).filter((x) => x.entity_id.startsWith("calendar."))
      .sort((a, b) => fold(a.attributes.friendly_name).localeCompare(fold(b.attributes.friendly_name)));
    if (!cals.length) return `<div class="card muted">${t.no_calendar}</div>`;
    if (!cals.some((c) => c.entity_id === d.calendar)) d.calendar = cals[0].entity_id;
    const sel = cals.map((c) => `<option value="${esc(c.entity_id)}" ${c.entity_id === d.calendar ? "selected" : ""}>${
      esc(c.attributes.friendly_name || c.entity_id)}</option>`).join("");
    const ev = [["start", t.cal_start], ["end", t.cal_end]]
      .map(([k, label]) => `<button class="chip ${d.calEvent === k ? "on" : ""}" data-a="calev" data-v="${k}">${label}</button>`).join("");
    const off = CAL_OFFSETS.map((m) => `<option value="${m}" ${d.calOffset === m ? "selected" : ""}>${
      m === 0 ? t.at_exact : fmt(t.min_before, this._dur(m))}</option>`).join("");
    return `<div class="cols">
        <label class="field">${t.calendar}<select id="calendar">${sel}</select></label>
        <label class="field">${t.offset}<select id="caloff">${off}</select></label>
      </div>
      <div class="chips" style="margin-top:12px">${ev}</div>
      <label class="field">${t.cal_word}<input type="text" id="calword" value="${esc(d.calWord)}" placeholder="${esc(t.cal_word_ph)}"></label>`;
  }

  // "a un jour et une heure" : heure, jours de la semaine, toutes les semaines ou une sur deux
  _timePicker() {
    const t = this._t, d = this._draft;
    const days = WEEKDAYS.map((k) => `<button class="chip ${d.days.includes(k) ? "on" : ""}" data-a="day" data-v="${k}">${esc(this._dayName(k))}</button>`).join("");
    const all = d.days.length === 7;
    const week = isoWeek(new Date()) % 2;
    const parity = d.every === 2 ? `<label class="field">&nbsp;<select id="parity">
        <option value="${week}" ${d.parity === week ? "selected" : ""}>${t.parity_this}</option>
        <option value="${1 - week}" ${d.parity !== week ? "selected" : ""}>${t.parity_next}</option></select></label>` : "";
    return `<div class="cols">
        <label class="field">${t.at_time}<input type="time" id="ttime" value="${esc(d.time)}"></label>
        <label class="field">${t.every}<select id="every">
          <option value="1" ${d.every !== 2 ? "selected" : ""}>${t.every1}</option>
          <option value="2" ${d.every === 2 ? "selected" : ""}>${t.every2}</option></select></label>
        ${parity}
      </div>
      <h3>${t.days}</h3><div class="chips">${days}
        <button class="chip ${all ? "on" : ""}" data-a="alldays">${t.every_day}</button></div>`;
  }

  // ce qui manque a l'etape 2 (texte du message d'erreur), ou ""
  _step2Missing(d) {
    const t = this._t;
    if (ENTITY_TRIGS.includes(d.trig) && !d.entities.length) return t.need_entity;
    if (d.trig === "value" && (d.threshold === "" || isNaN(Number(d.threshold)))) return t.need_threshold;
    if (d.trig === "time" && !d.days.length) return t.need_day;
    if (d.trig === "calendar" && !d.calendar) return t.need_calendar;
    return "";
  }

  _renderEntities() {
    const t = this._t, d = this._draft, box = this.shadowRoot.getElementById("elist");
    if (!box) return;
    const q = fold(this._eq.trim());
    let list = Object.values(this._hass.states).filter((s) => !s.entity_id.startsWith("automation.")
      && !s.entity_id.startsWith("update.") && !d.entities.includes(s.entity_id));
    if (q) list = list.filter((s) => fold(s.attributes.friendly_name).includes(q) || fold(s.entity_id).includes(q));
    else if (d.trig === "value" || d.trig === "periodic") list = list.filter((s) => s.attributes.unit_of_measurement && !isNaN(parseFloat(s.state)));
    else list = list.filter((s) => SUGGESTED.includes(s.entity_id.split(".")[0]));
    list = list.sort((a, b) => fold(a.attributes.friendly_name || a.entity_id).localeCompare(fold(b.attributes.friendly_name || b.entity_id))).slice(0, 60);
    box.innerHTML = (q ? "" : `<small class="muted">${t.e_suggest}</small>`)
      + (list.map((s) => `<button class="erow" data-a="entity" data-e="${esc(s.entity_id)}"><b>${esc(s.attributes.friendly_name || s.entity_id)}</b>
        <small>${esc(s.entity_id)} · ${esc(this._state(s.entity_id, s.state))}</small></button>`).join("") || `<p class="muted">${t.e_none}</p>`);
  }

  _step3() {
    const t = this._t, d = this._draft;
    this._fixMode(d);
    const sw = Object.entries(COLORS).map(([k, c]) => `<button class="sw ${d.color === k ? "on" : ""}" data-a="color" data-c="${k}" title="${esc(t.colors[k])}" style="background:${c}"></button>`).join("");
    const eff = EFFECTS.map((e) => `<option value="${e}" ${d.effect === e ? "selected" : ""}>${esc(t.effects[e])}</option>`).join("");
    const fonts = this._panelOf(d.device).fonts || [];
    const fontOpts = [["", t.dflt], [PIXEL, t.font_pixel]].concat(fonts.map((f) => [f, fontLabel(f)]))
      .concat(d.font && d.font !== PIXEL && !fonts.includes(d.font) ? [[d.font, fontLabel(d.font)]] : [])
      .map(([v, l]) => `<option value="${esc(v)}" ${d.font === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    const sizeOpts = `<option value="">${t.size_auto}</option>` + SIZES.concat(d.size && !SIZES.includes(d.size) ? [d.size] : [])
      .map((v) => `<option value="${v}" ${d.size === v ? "selected" : ""}>${fmt(t.size_px, v)}</option>`).join("");
    const num = (sel, max) => `<option value="">${t.dflt}</option>` + Array.from({ length: max }, (_, i) => `<option ${sel === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("");
    const withEntities = ENTITY_TRIGS.includes(d.trig);
    const inserts = d.trig === "calendar" ? `<button data-a="insert" data-k="event">${t.insert_event}</button>`
      : d.trig === "periodic" ? d.entities.map((e) => `<button data-a="insert" data-k="fixed" data-e="${esc(e)}">${esc(fmt(t.insert, this._name(e)))}</button>`).join("")
      : !withEntities ? ""
      : d.entities.length === 1
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
        <label class="field">${t.font}<select id="font">${fontOpts}</select></label>
        <label class="field">${t.size}<select id="size">${sizeOpts}</select></label>
        <label class="field" title="${esc(t.lines_help)}">${t.lines}<select id="lines">
          <option value="1" ${d.lines !== 2 ? "selected" : ""}>${t.lines_1}</option>
          <option value="2" ${d.lines === 2 ? "selected" : ""}>${t.lines_2}</option></select></label>
      </div>
      ${this._displayPicker()}
      <div class="preview" id="pvbox">${this._previewHtml()}</div>
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
      if (/calendar_event/.test(inner)) return d.calWord.trim() || this._t.sample_event;
      return "…";
    });
  }

  // icone liee a une GIF : meme nom dans la categorie Icones (Domotique/porte_ouverte.gif ->
  // Icones/porte_ouverte.gif) ; une GIF choisie dans Icones est sa propre icone
  _iconFor(gif) {
    if (!gif) return "";
    const parts = gif.split("/");
    if (parts[0] === ICON_CATEGORY) return gif;
    const icon = `${ICON_CATEGORY}/${parts.slice(1).join("/")}`;
    return this._panelOf(this._draft.device).gifs.includes(icon) ? icon : "";
  }

  _icons() {
    return this._panelOf(this._draft.device).gifs.filter((g) => g.split("/")[0] === ICON_CATEGORY);
  }

  // mode d'affichage coherent avec la GIF choisie
  _fixMode(d) {
    if (d.gif && d.gif.split("/")[0] === ICON_CATEGORY) { d.mode = "icon"; d.icon = d.gif; }
    if (d.mode === "icon" && !d.icon) d.icon = this._iconFor(d.gif) || this._icons()[0] || "";
    if (d.mode === "icon" && !d.icon) d.mode = "gif";
  }

  // affichage : la GIF complete puis le texte, ou l'icone a gauche avec le texte a cote
  _displayPicker() {
    const t = this._t, d = this._draft;
    const icons = this._icons();
    if (!icons.length) return "";
    const onlyIcon = d.gif && d.gif.split("/")[0] === ICON_CATEGORY;
    const chips = (onlyIcon ? "" : `<button class="chip ${d.mode !== "icon" ? "on" : ""}" data-a="mode" data-m="gif">${d.gif ? t.mode_gif : t.mode_text}</button>`)
      + `<button class="chip ${d.mode === "icon" ? "on" : ""}" data-a="mode" data-m="icon">${t.mode_icon}</button>`;
    // icone choisie d'office (celle de la GIF) ; la liste ne s'ouvre qu'avec "Changer l'icone"
    let tiles = "";
    if (d.mode === "icon" && this._pickIcon) {
      tiles = `<p class="help">${t.icon_help}</p><div class="icons">${icons.map((g) => `<button class="ico ${d.icon === g ? "on" : ""}" data-a="icon"
          data-g="${esc(g)}" title="${esc(gifLabel(g))}">${this._screen(d.device, g, "icobox")}</button>`).join("")}</div>`;
    } else if (d.mode === "icon") {
      tiles = `<div class="row"><div class="ico on">${this._screen(d.device, d.icon, "icobox")}</div>
        <span>${esc(gifLabel(d.icon))}</span><button class="link" data-a="pickicon">${t.change_icon}</button></div>`;
    }
    return `<h3>${t.mode}</h3><div class="chips">${chips}</div>${tiles}`;
  }

  _previewHtml() {
    const d = this._draft;
    return `${d.mode === "icon" ? "" : this._screen(d.device, d.gif, "screen")}<div class="screen" id="pv">${this._marquee()}</div>`;
  }

  // apercu du texte avec l'effet, la police, la taille et la vitesse choisis ; taille, pages et
  // durees calculees comme sur le panneau (clockrender.cpp FitPages/SplitPages, dmdapp.cpp)
  _marquee(d = this._draft) {
    if (!d.message) return "";
    const c = COLORS[d.color] || "#fff";
    const rainbow = c.startsWith("linear");
    const paint = rainbow ? `background:${c};-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${c}`;
    const icon = d.mode === "icon" && d.icon ? this._pvIcon(d) : "";
    const text = this._sample(d.message, d);
    const s = d.speed || DEFAULT_SPEED;
    const paged = PAGED.includes(d.effect);
    const L = this._layout(d, text, paged, !!icon);
    const area = icon ? this._iconArea(d) : 0;      // pixels reserves a gauche (icone + 3)
    const font = this._fontCss(L);
    // interligne : hauteur d'une ligne + 2 pixels (comme le panneau)
    const lh = `line-height:${(((L.lineHeight + LINE_GAP) * 100) / 32).toFixed(1)}cqh`;
    const show = (str) => esc(str).replace(/\n/g, "<br>");
    const wrap = (html, css = "") => `${icon}<div class="${d.priority ? "blinker" : "pvtext"}">${html}</div>${css ? `<style>${css}</style>` : ""}`;
    if (!paged) {
      // defilement : la duree depend de la longueur du texte (calculee par _tune une fois affiche)
      return wrap(`<div class="marquee scroll" style="${font};${paint};animation:${d.effect === "inverse" ? "mqr" : "mq"} var(--dur, 7s) linear infinite">${esc(text)}</div>`);
    }
    // chaque page : entree, pause, sortie ; les pages se suivent dans une seule boucle
    const times = L.pages.map((pg) => {
      const n = Math.max(1, [...pg.replace(/\n/g, "")].length);
      let tin = 1300 - s * 90;
      if (d.effect === "lettres") tin = n * (200 - s * 15);
      if (d.effect === "pluie") tin = 600 + n * (130 - s * 9);
      const hold = Math.min(5000, 1200 + n * 60);
      return { n, tin, hold, tout: d.effect === "lettres" ? tin / 3 : tin };
    });
    const total = times.reduce((a, x) => a + x.tin + x.hold + x.tout, 0);
    const pc = (ms) => `${Math.min(100, Math.max(0, (ms / total) * 100)).toFixed(3)}%`;
    const anim = (name, timing = "linear") => `animation:${name} ${(total / 1000).toFixed(2)}s ${timing} infinite`;
    const PALETTE = ["#ff2a2a", "#ff8a00", "#ffee00", "#2bff3a", "#22e3d2", "#3a6bff", "#a24bff", "#ff52b4"];
    const k = `pv${(this._seq = (this._seq || 0) + 1)}`;
    let css = "", t0 = 0, nth = 0;
    const spans = L.pages.map((pg, pi) => {
      const { n, tin, hold, tout } = times[pi];
      const A = t0, B = A + tin, C = B + hold, D = C + tout;
      t0 = D;
      const name = `${k}_${pi}`;
      if (d.effect === "lettres" || d.effect === "pluie") {
        const letters = [...pg.replace(/\n/g, "")].map((ch, i) => {
          const nm = `${name}_${i}`;
          const col = rainbow ? PALETTE[nth++ % PALETTE.length] : c;
          if (d.effect === "lettres") {
            // apparait lettre par lettre, s'efface depuis la fin
            css += `@keyframes ${nm}{0%{opacity:0}${pc(A + (tin * (i + 1)) / n)}{opacity:1}${pc(C + (tout * (n - i)) / n)}{opacity:0}100%{opacity:0}}`;
            return `<span class="l" style="color:${col};${anim(nm, "step-end")}">${esc(ch)}</span>`;
          }
          // pluie : chaque lettre tombe a son tour (depart etale sur 60 %, chute en 40 %)
          const a = A + (tin * 0.6 * i) / n, b = C + (tout * 0.6 * i) / n;
          css += `@keyframes ${nm}{0%,${pc(a)}{transform:translateY(-100cqh);animation-timing-function:ease-in}`
            + `${pc(a + tin * 0.4)},${pc(b)}{transform:none;animation-timing-function:ease-in}`
            + `${pc(b + tout * 0.4)},100%{transform:translateY(100cqh)}}`;
          return `<span class="l" style="color:${col};${anim(nm)}">${esc(ch)}</span>`;
        }).join("");
        // saut de ligne remis apres les lettres de la premiere ligne
        const cut = pg.indexOf("\n") < 0 ? -1 : [...pg.slice(0, pg.indexOf("\n"))].length;
        const parts = letters.split("</span>");
        const joined = cut < 0 ? letters : parts.slice(0, cut).join("</span>") + "</span><br>" + parts.slice(cut).join("</span>");
        return `<span class="t" style="${lh}">${joined}</span>`;
      }
      // monte : entre par le bas, sort par le haut ; descend : l'inverse ; fondu : apparait puis s'efface
      if (d.effect === "fondu") {
        css += `@keyframes ${name}{0%,${pc(A)}{opacity:0}${pc(B)},${pc(C)}{opacity:1}${pc(D)},100%{opacity:0}}`;
      } else {
        const from = d.effect === "monte" ? "translateY(100cqh)" : "translateY(-100cqh)";
        const to = d.effect === "monte" ? "translateY(-100cqh)" : "translateY(100cqh)";
        css += `@keyframes ${name}{0%,${pc(A)}{transform:${from}}${pc(B)},${pc(C)}{transform:none}${pc(D)},100%{transform:${to}}}`;
      }
      return `<span class="t" style="${paint};${lh};${anim(name)}">${show(pg)}</span>`;
    }).join("");
    const left = area ? `left:${((area * 100) / 128).toFixed(2)}cqw;` : "";
    return wrap(`<div class="marquee page" style="${left}${font}">${spans}</div>`, css);
  }

  // taille du texte et pages, comme le panneau : taille automatique = la plus grande qui tient en
  // hauteur ; effets en pages : reduite jusqu'a tenir en 3 pages au plus, coupees entre les mots
  _layout(d, text, paged, withIcon) {
    const family = d.font && d.font !== PIXEL ? this._fontFamily(d) : null;
    const W = 128 - (withIcon ? this._iconArea(d) : 0);
    let ctx = null;
    if (family) {
      try { ctx = (this._canvas = this._canvas || document.createElement("canvas").getContext("2d")); } catch (e) { ctx = null; }
    }
    const scale = (size) => Math.max(1, Math.floor((size + 3) / 7));     // police Pixel : 5x7 agrandie
    const width = (str, size) => {
      if (!ctx) return [...str].length * 6 * scale(size) - scale(size);
      ctx.font = `${size}px '${family}'`;
      return ctx.measureText(str).width;
    };
    const height = (size) => {
      if (!ctx) return 7 * scale(size);
      ctx.font = `${size}px '${family}'`;
      const m = ctx.measureText("HÉgy");
      return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    };
    const two = paged && d.lines === 2;
    const lineMax = two ? (32 - LINE_GAP) / 2 : 32;          // deux lignes l'une sous l'autre
    let max = 6;
    for (let s = 48; s >= 6; s--) if (height(s) <= lineMax) { max = s; break; }
    // lignes coupees entre les mots ; deux lignes par page : "ligne 1\nligne 2"
    const split = (size) => {
      const lines = splitLines(size);
      if (!two) return lines;
      const pages = [];
      for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).join("\n"));
      return pages;
    };
    const pageWidth = (pg, size) => Math.max(...pg.split("\n").map((l) => width(l, size)));
    const result = (size, pages) => ({ family, size, pages, lineHeight: height(size) });
    const splitLines = (size) => {
      const pages = [];
      let line = "";
      for (const word of text.split(" ").filter(Boolean)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (line && width(tryLine, size) > W - 4) { pages.push(line); line = word; } else line = tryLine;
      }
      if (line) pages.push(line);
      return pages.length ? pages : [text];
    };
    if (!paged) return result(d.size || max, [text]);
    if (d.size) return result(d.size, split(d.size));
    let fallback = 0;
    for (let s = max; s >= 6; s--) {
      const pages = split(s);
      const fits = pages.every((pg) => pageWidth(pg, s) <= W - 2);
      if (fits && pages.length <= 3) return result(s, pages);
      if (fits && !fallback) fallback = s;
    }
    const size = fallback || 6;
    return result(size, split(size));
  }

  // icone a gauche du texte : seulement ses colonnes dessinees, collees au bord (comme le panneau)
  _pvIcon(d) {
    const m = this._iconInfo(d);
    const p = this._panelOf(d.device);
    if (!m || !m.width) return `<div class="pvicon">${this._screen(d.device, d.icon, "icobox")}</div>`;
    const cq = (px) => ((px * 100) / 128).toFixed(2);
    return `<div class="pvicon" style="aspect-ratio:auto;width:${cq(m.width)}cqw;overflow:hidden">
      <img class="gif" data-entry="${esc(p.entry_id)}" data-gif="${esc(d.icon)}" alt="" style="width:${cq(m.gw)}cqw;height:${((m.gh * 100) / 32).toFixed(2)}cqh;
      max-width:none;object-fit:fill;margin-left:-${cq(m.x0)}cqw;margin-top:${(((32 - m.gh) / 2) * 100 / 32).toFixed(2)}cqh"></div>`;
  }

  // pixels reserves a gauche pour l'icone : sa largeur dessinee + 3 (ICON_GAP du panneau)
  _iconArea(d) {
    const m = this._iconInfo(d);
    if (!m) return ICON_WIDTH + 3;              // pas encore mesuree
    return m.width ? m.width + 3 : 0;           // trop large ou vide : le panneau l'ignore
  }

  // mesure de l'icone (toutes ses images) : colonnes dont un pixel depasse 24 ; null tant qu'inconnue
  _iconInfo(d) {
    this._iconW = this._iconW || new Map();
    const p = this._panelOf(d.device);
    const key = `${p.entry_id}|${d.icon}`;
    const v = this._iconW.get(key);
    if (v && v !== "loading") return v;
    if (v === undefined) {
      this._iconW.set(key, "loading");
      this._measureIcon(p.entry_id, d.icon)
        .then((m) => { this._iconW.set(key, m); this._refreshPreview(); })
        .catch(() => this._iconW.set(key, null));
    }
    return null;
  }

  async _measureIcon(entry, gif) {
    const cat = gif.split("/")[0], name = gif.split("/").slice(1).join("/");
    const r = await this._hass.fetchWithAuth(`/api/orbitdmd/gif/${encodeURIComponent(entry)}/${encodeURIComponent(cat)}/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error(r.status);
    const anim = GifFrames.decode(new Uint8Array(await r.arrayBuffer()));
    const gw = anim.w, gh = anim.h;
    let x0 = gw, x1 = -1;
    for (const fr of anim.frames) {
      const px = fr.rgba;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const k = (y * gw + x) * 4;
        if (px[k + 3] && (px[k] > 24 || px[k + 1] > 24 || px[k + 2] > 24)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      }
    }
    const width = x1 < x0 || x1 - x0 + 1 > 64 ? 0 : x1 - x0 + 1;
    return { width, x0: Math.max(0, x0), gw, gh };
  }

  // police et taille de l'apercu (100cqh = les 32 pixels du panneau) ; police Pixel imitee
  _fontCss(L) {
    if (L.family) return `font-family:'${L.family}';font-size:${((L.size * 100) / 32).toFixed(1)}cqh`;
    const scale = Math.max(1, Math.floor((L.size + 3) / 7));
    // police Pixel du panneau (orbitdmd-pixel.ttf : un pixel = 1/10 de la taille, 6 pixels d'avance)
    if (this._pixelFont() ) return `font-family:'${PIXEL_FAMILY}';font-size:${((10 * scale * 100) / 32).toFixed(2)}cqh`;
    // en attendant qu'elle soit chargee : police a chasse fixe, a peu pres de la meme taille
    return `font-family:'Courier New',monospace;font-weight:bold;letter-spacing:-.07em;font-size:${((7 * scale * 100) / 0.62 / 32).toFixed(1)}cqh`;
  }

  // charge une fois orbitdmd-pixel.ttf (a cote de cette page) ; vrai quand elle est prete
  _pixelFont() {
    if (this._pixel === "ok") return true;
    if (this._pixel || typeof FontFace === "undefined") return false;
    this._pixel = "loading";
    new FontFace(PIXEL_FAMILY, `url(${new URL("./orbitdmd-pixel.ttf", import.meta.url).pathname})`).load()
      .then((face) => { document.fonts.add(face); this._pixel = "ok"; this._refreshPreview(); })
      .catch(() => { this._pixel = "fail"; });
    return false;
  }

  // police du panneau chargee dans le navigateur (relais /api/orbitdmd/font/...) ; null tant
  // qu'elle n'est pas prete (ou si le panneau ne la donne pas : programme plus ancien que 1.7.0)
  _fontFamily(d) {
    const p = this._panelOf(d.device);
    const key = `${p.entry_id}|${d.font}`;
    const family = `odmd-${key.replace(/[^A-Za-z0-9]/g, "_")}`;
    this._fonts = this._fonts || new Map();
    const state = this._fonts.get(key);
    if (state === "ok") return family;
    if (state === undefined && (p.fonts || []).includes(d.font)) {
      this._fonts.set(key, "loading");
      this._hass.fetchWithAuth(`/api/orbitdmd/font/${encodeURIComponent(p.entry_id)}/${encodeURIComponent(d.font)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((buf) => new FontFace(family, buf).load())
        .then((face) => { document.fonts.add(face); this._fonts.set(key, "ok"); this._refreshPreview(); })
        .catch(() => this._fonts.set(key, "fail"));
    }
    return null;
  }

  // duree du defilement : (largeur du texte + largeur du panneau) / vitesse du panneau
  _tune() {
    const s = (this._draft && this._draft.speed) || DEFAULT_SPEED;
    this.shadowRoot.querySelectorAll(".marquee.scroll").forEach((el) => {
      const box = el.closest(".screen");
      if (!box || !box.clientWidth) return;
      const px = (el.scrollWidth * 128) / box.clientWidth;
      el.style.setProperty("--dur", `${((px + 128) / (10 + s * 15)).toFixed(2)}s`);
    });
  }

  _refreshPreview() {
    const box = this.shadowRoot.getElementById("pvbox");
    if (box) box.innerHTML = this._previewHtml();
    else if (this._view === 4 || this._view === "home" || this._view === "alexa") {
      // police ou mesure d'icone arrivee pendant l'etape 4 ou sur la liste : un seul rendu groupe
      if (!this._redraw) this._redraw = requestAnimationFrame(() => { this._redraw = 0; this._render(); });
      return;
    }
    this._observe();      // vignette de l'icone
    this._tune();
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
        ${prio && ENTITY_TRIGS.includes(d.trig) ? `<span>${t.repeat}</span><select id="repeat">${mins(REPEATS, d.repeat, t.no_repeat)}</select>` : ""}
        <small>${t.prio_help}</small>
      </div>
      <div class="preview">${d.mode === "icon" ? `<div class="screen">${this._marquee()}</div>` : this._screen(d.device, d.gif, "screen")}</div>
      <dl class="sum">
        ${panels.length > 1 ? `<dt>${t.sum_panel}</dt><dd>${esc(this._panelOf(d.device).title)}</dd>` : ""}
        <dt>${t.sum_gif}</dt><dd>${esc(d.gif || "—")}</dd>
        <dt>${t.sum_when}</dt><dd>${esc(this._whenText(d))}</dd>
        <dt>${t.sum_text}</dt><dd>${esc(d.message ? this._sample(d.message) : "—")}</dd>
        ${d.mode === "icon" ? `<dt>${t.icon}</dt><dd>${esc(d.icon)}</dd>` : ""}
        <dt>${t.color}</dt><dd>${esc(t.colors[d.color] || d.color)} · ${esc(t.effects[d.effect] || d.effect)}</dd>
        <dt>${t.font}</dt><dd>${esc(!d.font ? t.dflt : d.font === PIXEL ? t.font_pixel : fontLabel(d.font))} · ${esc(d.size ? fmt(t.size_px, d.size) : t.size_auto)}${d.lines === 2 && PAGED.includes(d.effect) ? ` · ${esc(t.lines_2)}` : ""}</dd>
      </dl>`;
  }

  // ---------- donnees ----------

  // ---------- menu Alexa ----------

  // icones de notification du panneau choisi
  _axIcons(device) {
    return this._panelOf(device).gifs.filter((g) => g.split("/")[0] === ICON_CATEGORY);
  }

  async _openAlexa(add = []) {
    try {
      this._axDevices = await AX.alexaDevices(this._hass);
    } catch (err) { this._axDevices = []; }
    const panel = this._data.panels[0].device_id;
    const s = AX.settingsFrom(Object.values(this._configs), this._t, this._axDevices, panel, this._axIcons(panel));
    for (const id of add) if (!s.echos.includes(id)) s.echos.push(id);
    // tout est replie, sauf les appareils la premiere fois (aucune alerte Alexa encore) ou un appareil a ajouter
    const first = !Object.values(this._configs).some(AX.isAlexa);
    this._ax = { settings: s, pick: null, open: new Set(), devOpen: first || add.length > 0 };
    this._go("alexa");
  }

  // piece d'exemple pour l'apercu : celle du premier appareil coche
  _axRoom() {
    const s = this._ax.settings;
    const d = (this._axDevices || []).find((x) => s.echos.includes(x.id));
    return d ? d.area || d.name : "";
  }

  // brouillon d'apercu : icone + texte d'exemple, comme le panneau l'affichera
  _axDraft(key, e, s, room) {
    return { device: s.device, mode: "icon", icon: e.icon, gif: "", message: AX.sampleText(key, e, s, this._t, room),
      color: e.color, effect: e.effect, priority: e.prio, speed: e.speed || null, font: e.font || "", size: e.size || 0,
      lines: e.lines === 2 ? 2 : 1, entities: [], trig: "entity", calWord: "" };
  }

  _axPreview(key) {
    const box = this.shadowRoot.getElementById(`axpv_${key}`);
    if (!box) return;
    const s = this._ax.settings;
    box.innerHTML = this._marquee(this._axDraft(key, s.events[key], s, this._axRoom()));
    this._observe();
    this._tune();
  }

  // choix police, taille, lignes, vitesse, passages (memes listes qu'a l'etape 3)
  _styleOpts(o, device) {
    const t = this._t;
    const fonts = this._panelOf(device).fonts || [];
    const font = [["", t.dflt], [PIXEL, t.font_pixel]].concat(fonts.map((x) => [x, fontLabel(x)]))
      .concat(o.font && o.font !== PIXEL && !fonts.includes(o.font) ? [[o.font, fontLabel(o.font)]] : [])
      .map(([v, l]) => `<option value="${esc(v)}" ${(o.font || "") === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    const size = `<option value="">${t.size_auto}</option>` + SIZES.concat(o.size && !SIZES.includes(o.size) ? [o.size] : [])
      .map((v) => `<option value="${v}" ${o.size === v ? "selected" : ""}>${fmt(t.size_px, v)}</option>`).join("");
    const num = (sel, max) => `<option value="">${t.dflt}</option>` + Array.from({ length: max }, (_, i) => `<option ${sel === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("");
    const lines = `<option value="1" ${o.lines !== 2 ? "selected" : ""}>${t.lines_1}</option><option value="2" ${o.lines === 2 ? "selected" : ""}>${t.lines_2}</option>`;
    return { font, size, speed: num(o.speed, 10), passes: num(o.passes, 5), lines };
  }

  _alexaView() {
    const t = this._t, s = this._ax.settings, devices = this._axDevices || [];
    const back = `<div class="nav"><button data-a="axback">${t.back}</button>`;
    if (!devices.length) return `<h2>${t.ax_title}</h2><div class="card muted">${esc(t.ax_missing)}</div>${back}</div>`;
    const panels = this._data.panels;
    const panelSel = panels.length > 1 ? `<label class="field">${t.sum_panel}<select data-ax="panel">${panels.map((p) =>
      `<option value="${esc(p.device_id)}" ${p.device_id === s.device ? "selected" : ""}>${esc(p.title)}</option>`).join("")}</select></label>` : "";
    const devs = devices.map((d) => {
      const off = (this._hass.states[d.timer] || {}).state === "unavailable";
      const info = [d.model, d.area, off ? t.ax_offline : ""].filter(Boolean).join(" · ");
      return `<label class="opt axdev"><input type="checkbox" data-ax="dev" data-dev="${esc(d.id)}" ${s.echos.includes(d.id) ? "checked" : ""}>
        <span><b>${esc(d.name)}</b><br><small class="muted">${esc(info)}</small></span></label>`;
    }).join("");
    const room = this._axRoom();
    const colorOpts = (sel) => Object.keys(COLORS).map((k) => `<option value="${k}" ${sel === k ? "selected" : ""}>${esc(t.colors[k])}</option>`).join("");
    const effectOpts = (sel) => EFFECTS.map((k) => `<option value="${k}" ${sel === k ? "selected" : ""}>${esc(t.effects[k])}</option>`).join("");
    const open = this._ax.open;
    // petite fleche : deplier / replier
    const foldBtn = (attrs, isOpen) => `<button class="fold" ${attrs} aria-expanded="${isOpen}" title="${esc(isOpen ? t.ax_fold : t.ax_unfold)}">`
      + `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;
    const events = AX.EVENTS.map((ev) => {
      const k = ev.key, e = s.events[k], isOpen = open.has(k);
      const title = `<label class="lead"><input type="checkbox" data-ax="on" data-ev="${k}" ${e.on ? "checked" : ""}><b>${esc(t[`ax_ev_${k}`])}</b></label>
        <small class="muted">${esc(t[`ax_when_${k}`])}</small>`;
      if (!e.on) return `<div class="card axev off"><div class="axhead"><div class="grow">${title}</div></div></div>`;
      // replie : le titre, un petit apercu et la fleche
      if (!isOpen) return `<div class="card axev"><div class="axhead"><div class="grow">${title}</div>
        <div class="screen axmini" id="axpv_${k}" data-a="axfold" data-ev="${k}" title="${esc(t.ax_unfold)}">${this._marquee(this._axDraft(k, e, s, room))}</div>
        ${foldBtn(`data-a="axfold" data-ev="${k}"`, false)}</div></div>`;
      const head = `<div class="axhead"><div class="grow">${title}</div>${foldBtn(`data-a="axfold" data-ev="${k}"`, true)}</div>`;
      const st = this._styleOpts(e, s.device);
      const toks = ev.tokens.map((tok) => `<button data-a="axtok" data-ev="${k}" data-k="${tok}">+ ${esc(t[`ax_tok_${tok}`])}</button>`).join("");
      const icons = this._ax.pick === k ? `<div class="icons">${this._axIcons(s.device).map((g) => `<button class="ico ${e.icon === g ? "on" : ""}"
          data-a="axicon" data-ev="${k}" data-g="${esc(g)}" title="${esc(gifLabel(g))}">${this._screen(s.device, g, "icobox")}</button>`).join("")}</div>` : "";
      return `<div class="card axev">${head}
        <div class="axrow">
          <div class="screen axpv" id="axpv_${k}">${this._marquee(this._axDraft(k, e, s, room))}</div>
          <div class="grow">
            <label class="field">${t.text}<input type="text" maxlength="200" data-ax="text" data-ev="${k}" value="${esc(e.text)}"></label>
            <div class="bar">${toks}</div>
            ${k === "dictation" ? `<label class="field">${t.ax_keyword}<input type="text" maxlength="40" data-ax="keyword" data-ev="${k}" value="${esc(e.keyword)}"></label>` : ""}
            ${k === "voice" ? `<label class="field">${t.ax_skip}<input type="text" maxlength="300" data-ax="skip" data-ev="${k}" value="${esc(e.skip)}"></label>
              <label class="opt"><input type="checkbox" data-ax="reply" data-ev="${k}" ${e.reply ? "checked" : ""}>${esc(t.ax_reply)}</label>` : ""}
            <div class="cols">
              ${ev.every ? `<label class="field">${t.ax_every}<select data-ax="every" data-ev="${k}">${AX.EVERY.map((m) =>
                `<option value="${m}" ${e.every === m ? "selected" : ""}>${esc(fmt(t.ax_every_n, m))}</option>`).join("")}</select></label>` : ""}
              <label class="field">${t.color}<select data-ax="color" data-ev="${k}">${colorOpts(e.color)}</select></label>
              <label class="field">${t.effect}<select data-ax="effect" data-ev="${k}">${effectOpts(e.effect)}</select></label>
              <label class="field">${t.speed}<select data-ax="speed" data-ev="${k}">${st.speed}</select></label>
              <label class="field">${t.passes}<select data-ax="passes" data-ev="${k}">${st.passes}</select></label>
              <label class="field">${t.font}<select data-ax="font" data-ev="${k}">${st.font}</select></label>
              <label class="field">${t.size}<select data-ax="size" data-ev="${k}">${st.size}</select></label>
              <label class="field" title="${esc(t.lines_help)}">${t.lines}<select data-ax="lines" data-ev="${k}">${st.lines}</select></label>
            </div>
            <label class="opt"><input type="checkbox" data-ax="prio" data-ev="${k}" ${e.prio ? "checked" : ""}>${esc(t.ax_prio)}</label>
            <div class="row"><div class="ico on">${this._screen(s.device, e.icon, "icobox")}</div>
              <button class="link" data-a="axpick" data-ev="${k}">${t.change_icon}</button>
              <button data-a="axtest" data-ev="${k}">▶ ${t.test_btn}</button></div>
            ${icons}
          </div>
        </div></div>`;
    }).join("");
    const upgraded = (s.upgraded || []).length ? `<div class="banner">${esc(t.ax_new_icons)}</div>` : "";
    const devCount = esc(fmt(t.ax_dev_count, s.echos.filter((id) => devices.some((d) => d.id === id)).length, devices.length));
    return `<h2>${t.ax_title}</h2><p class="help">${esc(t.ax_help)}</p>${upgraded}${panelSel}
      <div class="foldh"><h3>${t.ax_devices}</h3><small>${devCount}</small>${foldBtn(`data-a="axfolddev"`, this._ax.devOpen)}</div>
      ${this._ax.devOpen ? `<p class="help">${esc(t.ax_devices_help)}</p><div class="axdevs">${devs}</div>` : ""}
      <h3>${t.ax_events}</h3>${events}
      <h3>${t.ax_options}</h3>
      <label class="opt"><input type="checkbox" data-ax="room" ${s.room ? "checked" : ""}>${esc(t.ax_room)}</label>
      <div class="opt ${s.quiet ? "" : "off"}">
        <label class="lead"><input type="checkbox" data-ax="quiet" ${s.quiet ? "checked" : ""}>${t.quiet}</label>
        <input type="time" data-ax="qfrom" value="${esc(s.quietFrom)}" ${s.quiet ? "" : "disabled"}> ${t.to_h}
        <input type="time" data-ax="qto" value="${esc(s.quietTo)}" ${s.quiet ? "" : "disabled"}>
      </div>
      <p class="help">${esc(t.ax_off_note)}</p>
      ${back}<button class="primary" data-a="axsave">${t.ax_save}</button></div>`;
  }

  _axInput(el) {
    const s = this._ax.settings, k = el.dataset.ev, e = k ? s.events[k] : null;
    switch (el.dataset.ax) {
      case "dev":
        s.echos = el.checked ? s.echos.concat(el.dataset.dev) : s.echos.filter((x) => x !== el.dataset.dev);
        for (const ev of AX.EVENTS) this._axPreview(ev.key);      // la piece d'exemple peut changer
        return;
      // un evenement qu'on active s'ouvre pour montrer ses reglages
      case "on": e.on = el.checked; if (e.on) this._ax.open.add(k); else this._ax.open.delete(k); this._render(); return;
      case "text": e.text = el.value; break;
      case "color": e.color = el.value; break;
      case "effect":
        e.effect = el.value;
        // un texte qui defile reste sur une ligne
        if (!PAGED.includes(e.effect) && e.lines === 2) { e.lines = 1; this._render(); return; }
        break;
      case "lines":
        e.lines = el.value === "2" ? 2 : 1;
        if (e.lines === 2 && !PAGED.includes(e.effect)) { e.effect = "fondu"; this._toast(this._t.lines_effect); this._render(); return; }
        break;
      case "speed": e.speed = el.value ? Number(el.value) : null; break;
      case "passes": e.passes = el.value ? Number(el.value) : null; break;
      case "font": e.font = el.value; break;
      case "size": e.size = el.value ? Number(el.value) : 0; break;
      case "every": e.every = Number(el.value) || 1; return;
      case "prio": e.prio = el.checked; break;
      case "skip": e.skip = el.value; return;
      case "keyword": e.keyword = el.value; return;
      case "reply": e.reply = el.checked; break;
      case "room": s.room = el.checked; for (const ev of AX.EVENTS) this._axPreview(ev.key); return;
      case "quiet": s.quiet = el.checked; this._render(); return;
      case "qfrom": if (el.value) s.quietFrom = el.value.slice(0, 5); return;
      case "qto": if (el.value) s.quietTo = el.value.slice(0, 5); return;
      case "panel": s.device = el.value; this._render(); return;
    }
    if (k) this._axPreview(k);
  }

  // donnees envoyees au panneau pour "Tester" (texte d'exemple)
  _axNotify(key, e, s, room) {
    return AX.notifyData(e, s.device, AX.sampleText(key, e, s, this._t, room));
  }

  async _axSendData(data) {
    try {
      await this._hass.callWS({ type: "execute_script", sequence: [{ action: "orbitdmd.notify", data }] });
      this._toast(this._t.sent);
    } catch (err) { this._toast(fmt(this._t.error, err.message || err.code || err)); }
  }

  async _axSave() {
    const t = this._t, s = this._ax.settings;
    if (!s.echos.length) { this._toast(t.ax_need_device); return; }
    const { save, remove } = AX.alexaConfigs(s, this._axDevices, t);
    try {
      for (const id of remove) {
        if (!this._configs[id]) continue;
        await this._hass.callApi("DELETE", `config/automation/config/${id}`);
        delete this._configs[id];
      }
      for (const [id, cfg] of Object.entries(save)) {
        await this._hass.callApi("POST", `config/automation/config/${id}`, cfg);
        this._configs[id] = cfg;
      }
      this._toast(t.ax_saved);
      this._go("home");
      for (const id of Object.keys(save)) await this._categorizeId(id);
    } catch (err) { this._toast(fmt(t.error, err.message || err.body?.message || err)); }
  }

  // nouveaux Echo pas encore dans les alertes Alexa (et pas ignores sur ce navigateur)
  _axNew() {
    const cfgs = Object.values(this._configs).filter(AX.isAlexa);
    if (!cfgs.length || !this._axDevices || this._axHidden) return [];
    const echos = cfgs[0].variables.orbitdmd.echos || [];
    let ignored = [];
    try { ignored = JSON.parse(localStorage.getItem("orbitdmd_alexa_ignore") || "[]"); } catch (e) { ignored = []; }
    return this._axDevices.filter((d) => d.echo && !echos.includes(d.id) && !ignored.includes(d.id));
  }

  // reglages d'affichage d'une alerte Alexa enregistree
  _axEvent(m) {
    return { text: m.text, icon: m.icon, color: m.color, effect: m.effect, prio: !!m.prio, font: m.font || "", size: Number(m.size) || 0,
      lines: Number(m.lines) === 2 ? 2 : 1, speed: m.speed ? Number(m.speed) : null, passes: m.passes ? Number(m.passes) : null,
      reply: !!m.reply, keyword: m.keyword || "", skip: m.skip || "" };
  }

  // une alerte Alexa dans la liste : apercu, quand, appareils ; "Modifier" ouvre le menu Alexa
  _alexaRow(s, cfg) {
    const t = this._t, m = cfg.variables.orbitdmd, k = m.event;
    const notify = (cfg.actions || []).find((a) => a && a.action === "orbitdmd.notify") || { data: {} };
    const set = { device: (notify.data.device_id || [])[0] || this._data.panels[0].device_id, room: !!m.room };
    const e = this._axEvent(m);
    const dev = (this._axDevices || []).find((x) => (m.echos || []).includes(x.id));
    const room = dev ? dev.area || dev.name : "";
    const on = s.state === "on";
    const last = s.attributes.last_triggered
      ? fmt(t.last, new Date(s.attributes.last_triggered).toLocaleString(this._hass.language)) : t.never;
    const armed = this._confirm === s.attributes.id;
    const id = esc(s.attributes.id);
    const badges = `<span class="badge">${t.b_alexa}</span><span class="badge">${esc(fmt(t.ax_n_devices, (m.echos || []).length))}</span>`
      + (m.prio ? `<span class="badge prio">${t.b_prio}</span>` : "")
      + (m.quiet && !m.prio ? `<span class="badge">${esc(fmt(t.b_quiet, m.quiet_from, m.quiet_to))}</span>` : "");
    return `<div class="card alert ${on ? "" : "off"}">
      <div class="screen" style="border-radius:6px">${this._marquee(this._axDraft(k, e, set, room))}</div>
      <div class="info"><b>${esc(String(s.attributes.friendly_name || "").replace(/^OrbitDMD\s*[–-]\s*/, ""))}</b>
        <span>${esc(t[`ax_when_${k}`] || "")}</span>
        <span>« ${esc(AX.sampleText(k, e, set, t, room))} »</span>
        <span>${esc(last)}</span>
        <div class="badges">${badges}</div></div>
      <div class="acts">
        <label class="toggle" title="${esc(s.entity_id)}"><input type="checkbox" data-a="toggle" data-e="${esc(s.entity_id)}" ${on ? "checked" : ""}><i></i></label>
        <button data-a="axtestauto" data-id="${id}">${t.test}</button>
        <button data-a="alexa">${t.edit}</button>
        <button class="danger ${armed ? "armed" : ""}" data-a="del" data-id="${id}">${armed ? t.confirm_del : t.del}</button>
      </div></div>`;
  }

  _newDraft() {
    return { id: null, device: this._data.panels[0].device_id, gif: "", entities: [], to: null, message: "",
      color: "blanc", effect: "defile", speed: null, passes: null, name: "", font: "", size: 0, lines: 1,
      quiet: false, quietFrom: "23:00", quietTo: "07:00", cooldown: 0, priority: false, repeat: 0, icon: "", mode: "gif",
      trig: "entity", perEvery: 60, time: "19:00", days: [], every: 1, parity: isoWeek(new Date()) % 2,
      forMin: 0, cmp: "below", threshold: "", sunEvent: "sunset", sunOffset: 0,
      calendar: "", calEvent: "start", calOffset: 0, calWord: "" };
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
      entities: Array.isArray(meta.entities) ? meta.entities.slice() : [].concat(tr.entity_id || []), to: tr.to === undefined || tr.to === null ? null : String(tr.to),
      device: one(d.device_id) || this._data.panels[0].device_id, gif: d.gif || meta.gif || "", message: d.message || "",
      color: d.color || "blanc", effect: d.effect || "defile",
      speed: d.speed ? Number(d.speed) : null, passes: d.passes ? Number(d.passes) : null,
      font: d.font ? String(d.font) : "", size: Number(d.size) || 0, lines: Number(d.lines) === 2 ? 2 : 1,
      quiet: !!meta.quiet, quietFrom: hhmm(meta.quiet_from, "23:00"), quietTo: hhmm(meta.quiet_to, "07:00"),
      cooldown: Number(meta.cooldown) || 0, priority: meta.priority !== undefined ? !!meta.priority : !!d.blink,
      repeat: Number(meta.repeat) || 0, icon: d.icon || "",
      mode: meta.display || (d.icon && !d.gif ? "icon" : "gif"),
      trig: meta.trig || ({ time: "time", time_pattern: "periodic", numeric_state: "value", sun: "sun", calendar: "calendar" }[tr.trigger || tr.platform] || "entity"),
      forMin: Number(meta.for_min) || (tr.for && Number(tr.for.minutes)) || 0,
      cmp: meta.cmp || (tr.above !== undefined ? "above" : "below"),
      threshold: meta.threshold !== undefined ? String(meta.threshold) : String(tr.above ?? tr.below ?? ""),
      sunEvent: meta.sun_event || tr.event === "sunrise" ? (meta.sun_event || "sunrise") : "sunset",
      sunOffset: meta.sun_offset !== undefined ? Number(meta.sun_offset) : fromHms(tr.offset),
      calendar: meta.calendar || (tr.trigger === "calendar" ? one(tr.entity_id) || "" : ""),
      calEvent: meta.cal_event || (tr.trigger === "calendar" && tr.event === "end" ? "end" : "start"),
      calOffset: meta.cal_offset !== undefined ? Number(meta.cal_offset) : Math.abs(fromHms(tr.trigger === "calendar" ? tr.offset : 0)),
      calWord: meta.cal_word || "",
      perEvery: PERIODS.includes(Number(meta.per_every)) ? Number(meta.per_every) : 60,
      time: hhmm(meta.time || tr.at, "19:00"), days: Array.isArray(meta.days) ? meta.days : [],
      every: Number(meta.every) === 2 ? 2 : 1, parity: Number(meta.parity) === 1 ? 1 : 0,
    };
    o.autoName = this._autoName(o);     // un nom propose garde le suivi si l'etat change
    return o;
  }

  _notifyData(d) {
    const data = { device_id: [d.device] };
    // icone + texte : seulement l'icone (pas de GIF avant) ; sinon la GIF complete puis le texte
    if (d.mode === "icon" && d.icon) data.icon = d.icon;
    else if (d.gif) data.gif = d.gif;
    if (d.message) data.message = d.message;
    data.color = d.color;
    data.effect = d.effect;
    if (d.speed) data.speed = d.speed;
    if (d.passes) data.passes = d.passes;
    if (d.font) data.font = d.font;
    if (d.size) data.size = d.size;
    if (d.lines === 2 && PAGED.includes(d.effect)) data.lines = 2;
    if (d.priority) data.blink = true;
    return data;
  }

  _config(d) {
    let trigger;
    const when = [];       // conditions du declencheur "jour et heure"
    if (d.trig === "time") {
      trigger = { trigger: "time", at: `${d.time}:00` };
      if (d.days.length && d.days.length < 7) when.push({ condition: "time", weekday: WEEKDAYS.filter((k) => d.days.includes(k)) });
      // une semaine sur deux : semaine ISO paire ou impaire
      if (d.every === 2) when.push({ condition: "template", value_template: `{{ now().isocalendar()[1] % 2 == ${d.parity} }}` });
    } else if (d.trig === "periodic") {
      // minutes "/15" : a :00, :15, :30, :45 ; heures "/2" : a 0 h, 2 h, 4 h... (a l'heure pile)
      trigger = d.perEvery < 60 ? { trigger: "time_pattern", minutes: `/${d.perEvery}` }
        : { trigger: "time_pattern", hours: `/${d.perEvery / 60}`, minutes: 0 };
    } else if (d.trig === "sun") {
      trigger = { trigger: "sun", event: d.sunEvent };
      if (d.sunOffset) trigger.offset = hms(d.sunOffset);
    } else if (d.trig === "calendar") {
      trigger = { trigger: "calendar", event: d.calEvent, entity_id: d.calendar };
      if (d.calOffset) trigger.offset = hms(-d.calOffset);
      // seulement les evenements dont le titre contient le mot (sans tenir compte des majuscules)
      const word = d.calWord.trim().toLowerCase().replace(/['"\\{}%]/g, "");
      if (word) when.push({ condition: "template", value_template: `{{ '${word}' in (trigger.calendar_event.summary or '') | lower }}` });
    } else if (d.trig === "value") {
      trigger = { trigger: "numeric_state", entity_id: d.entities.length === 1 ? d.entities[0] : d.entities.slice(),
        [d.cmp === "above" ? "above" : "below"]: Number(d.threshold) };
      if (d.forMin) trigger.for = { minutes: d.forMin };
    } else {
      trigger = { trigger: "state", entity_id: d.entities.length === 1 ? d.entities[0] : d.entities.slice(), not_from: ["unavailable"] };
      if (d.to === null) trigger.not_to = ["unavailable", "unknown"];   // tout changement d'etat (pas les attributs)
      else trigger.to = d.to;
      if (d.forMin) trigger.for = { minutes: d.forMin };
    }
    const notify = { action: "orbitdmd.notify", data: this._notifyData(d) };
    const repeat = d.priority && d.repeat > 0 && ENTITY_TRIGS.includes(d.trig);
    const cooldown = !d.priority && d.cooldown > 0;
    let actions;
    if (repeat) {
      // alerte prioritaire : se repete tant que l'entite garde l'etat qui l'a declenchee
      actions = [{ repeat: {
        while: [{ condition: "template", value_template: d.trig === "value"
          ? `{{ repeat.index <= ${MAX_REPEATS} and (states(trigger.entity_id) | float(0)) ${d.cmp === "above" ? ">" : "<"} ${Number(d.threshold)} }}`
          : `{{ repeat.index <= ${MAX_REPEATS} and is_state(trigger.entity_id, trigger.to_state.state) }}` }],
        sequence: [notify, { delay: { minutes: d.repeat } }] } }];
    } else {
      // anti-repetition : l'automatisation reste "occupee" pendant le delai, les declenchements sont ignores
      actions = cooldown ? [notify, { delay: { minutes: d.cooldown } }] : [notify];
    }
    const conditions = when.concat(d.quiet && !d.priority
      ? [{ condition: "not", conditions: [{ condition: "time", after: `${d.quietFrom}:00`, before: `${d.quietTo}:00` }] }] : []);
    const cfg = {
      id: d.id, alias: `OrbitDMD – ${d.name}`, description: this._t.description,
      variables: { orbitdmd: { trig: d.trig, time: d.time, days: d.days, every: d.every, parity: d.parity,
        for_min: d.forMin, cmp: d.cmp, threshold: d.threshold, sun_event: d.sunEvent, sun_offset: d.sunOffset,
        calendar: d.calendar, cal_event: d.calEvent, cal_offset: d.calOffset, cal_word: d.calWord,
        per_every: d.perEvery, entities: d.trig === "periodic" ? d.entities.slice() : undefined,
        display: d.mode, gif: d.gif, quiet: d.quiet, quiet_from: d.quietFrom, quiet_to: d.quietTo,
        cooldown: d.cooldown, priority: d.priority, repeat: d.repeat } },
      triggers: [trigger], conditions, actions,
    };
    if (repeat || cooldown) { cfg.mode = "single"; cfg.max_exceeded = "silent"; }
    else { cfg.mode = "queued"; cfg.max = 5; }
    return cfg;
  }

  async _send(d) {
    const data = this._notifyData(d);
    const first = ENTITY_TRIGS.includes(d.trig) ? d.entities[0] : null;
    const so = first && this._hass.states[first];
    try {
      // execute_script calcule les modeles {{ ... }} comme le ferait l'automatisation ;
      // "trigger" est imite avec la premiere entite
      const variables = so ? { trigger: { entity_id: first, to_state: { name: this._name(first), state: so.state } } }
        : d.trig === "calendar" ? { trigger: { calendar_event: { summary: d.calWord.trim() || this._t.sample_event } } } : {};
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
    this._q = ""; this._eq = ""; this._other = false; this._pickIcon = false;
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
      case "alexa": await this._openAlexa(); break;
      case "axback": this._go("home"); break;
      case "axsave": await this._axSave(); break;
      case "axfold": {
        const o = this._ax.open, k = b.dataset.ev;
        if (o.has(k)) { o.delete(k); if (this._ax.pick === k) this._ax.pick = null; } else o.add(k);
        this._render(); break;
      }
      case "axfolddev": this._ax.devOpen = !this._ax.devOpen; this._render(); break;
      case "axpick": this._ax.pick = this._ax.pick === b.dataset.ev ? null : b.dataset.ev; this._render(); break;
      case "axicon": this._ax.settings.events[b.dataset.ev].icon = b.dataset.g; this._ax.pick = null; this._render(); break;
      case "axtok": {
        const ev = this._ax.settings.events[b.dataset.ev];
        ev.text = `${ev.text}${ev.text && !/\s$/.test(ev.text) ? " " : ""}{${b.dataset.k}}`;
        const i = this.shadowRoot.querySelector(`input[data-ax="text"][data-ev="${b.dataset.ev}"]`);
        if (i) { i.value = ev.text; i.focus(); }
        this._axPreview(b.dataset.ev); break;
      }
      case "axtest": { const st = this._ax.settings; await this._axSendData(this._axNotify(b.dataset.ev, st.events[b.dataset.ev], st, this._axRoom())); break; }
      case "axtestauto": {
        const m = this._configs[b.dataset.id].variables.orbitdmd;
        const n = (this._configs[b.dataset.id].actions || []).find((x) => x && x.action === "orbitdmd.notify") || { data: {} };
        const dev = (this._axDevices || []).find((x) => (m.echos || []).includes(x.id));
        await this._axSendData(this._axNotify(m.event, this._axEvent(m),
          { device: (n.data.device_id || [])[0], room: !!m.room }, dev ? dev.area || dev.name : ""));
        break;
      }
      case "axadd": await this._openAlexa(this._axNew().map((x) => x.id)); break;
      case "axignore":
        try {
          const ig = JSON.parse(localStorage.getItem("orbitdmd_alexa_ignore") || "[]");
          localStorage.setItem("orbitdmd_alexa_ignore", JSON.stringify(ig.concat(this._axNew().map((x) => x.id))));
        } catch (err) { /* navigateur sans stockage */ }
        this._axHidden = true; this._render(); break;
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
      case "gif": {
        // l'icone suit la GIF tant qu'on n'en a pas choisi une autre
        const linked = this._iconFor(d.gif);
        d.gif = b.dataset.gif;
        if (!d.icon || d.icon === linked) d.icon = this._iconFor(d.gif);
      }
        this.shadowRoot.querySelectorAll(".tile").forEach((x) => x.classList.toggle("on", x.dataset.gif === d.gif));
        break;
      case "trig": d.trig = b.dataset.v; this._render(); break;
      case "cmp": d.cmp = b.dataset.v; this._render(); break;
      case "sunev": d.sunEvent = b.dataset.v; this._render(); break;
      case "calev": d.calEvent = b.dataset.v; this._render(); break;
      case "day":
        d.days = d.days.includes(b.dataset.v) ? d.days.filter((k) => k !== b.dataset.v) : d.days.concat(b.dataset.v);
        this._render(); break;
      case "alldays": d.days = d.days.length === 7 ? [] : WEEKDAYS.slice(); this._render(); break;
      case "entity":
        if (!d.entities.includes(b.dataset.e)) d.entities.push(b.dataset.e);
        if (d.entities.length === 1) { d.to = null; this._other = false; }
        this._adding = false; this._eq = ""; this._render(); break;
      case "unentity": d.entities = d.entities.filter((x) => x !== b.dataset.e); if (!d.entities.length) d.to = null; this._render(); break;
      case "addentity": this._adding = true; this._render(); { const i = this.shadowRoot.getElementById("esearch"); if (i) i.focus(); } break;
      case "to": d.to = b.dataset.v === "" ? null : b.dataset.v; this._other = false; this._render(); break;
      case "other": this._other = true; this._render(); { const i = this.shadowRoot.getElementById("otherv"); if (i) i.focus(); } break;
      case "mode":
        d.mode = b.dataset.m;
        this._pickIcon = false;
        this._fixMode(d);
        this._render(); break;
      case "pickicon": this._pickIcon = true; this._render(); break;
      case "icon":           // icone choisie dans la liste : la liste se referme
        d.icon = b.dataset.g;
        this._pickIcon = false;
        this._render(); break;
      case "color":
        d.color = b.dataset.c;
        this.shadowRoot.querySelectorAll(".sw").forEach((x) => x.classList.toggle("on", x.dataset.c === d.color));
        this.shadowRoot.getElementById("cname").textContent = t.colors[d.color] || d.color;
        this._refreshPreview();
        break;
      case "insert": {
        const k = b.dataset.k;
        const tpl = k === "event" ? "{{ trigger.calendar_event.summary }}"
          : k === "name" ? "{{ trigger.to_state.name }}"
          : k === "value" ? this._valueTemplate("trigger.entity_id")
          : k === "fixed" ? this._valueTemplate(`'${b.dataset.e}'`) : this._valueTemplate(`'${d.entities[0]}'`);
        d.message = `${d.message}${d.message ? " " : ""}${tpl}`;
        const i = this.shadowRoot.getElementById("msg"); i.value = d.message; i.focus();
        this._refreshPreview();
        break;
      }
      case "test":
        if (!d.gif && !d.message) { this._toast(t.need_content); break; }
        if (d.mode === "icon" && !d.message) { this._toast(t.need_icon_text); break; }
        await this._send(d); break;
      case "goto": this._go(Number(b.dataset.s)); break;
      case "back": this._go(this._view === 1 ? "home" : this._view - 1); break;
      case "next":
        if (this._view === 2) { const why = this._step2Missing(d); if (why) { this._toast(why); break; } }
        if (this._view === 3 && !d.gif && !d.message) { this._toast(t.need_content); break; }
        if (this._view === 3 && d.mode === "icon" && !d.message) { this._toast(t.need_icon_text); break; }
        this._go(this._view + 1); break;
      case "save": {
        d.name = (d.name || "").trim();
        if (!d.name) { this._toast(t.need_name); break; }
        { const why = this._step2Missing(d); if (why) { this._toast(why); this._go(2); break; } }
        if (!d.gif && !d.message) { this._toast(t.need_content); this._go(3); break; }
        if (d.mode === "icon" && !d.message) { this._toast(t.need_icon_text); this._go(3); break; }
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
    if (el.dataset && el.dataset.ax) { if (e.type === "input") this._axInput(el); return; }
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
      case "msg": d.message = el.value; this._refreshPreview(); break;
      case "effect":
        d.effect = el.value;
        if (!PAGED.includes(d.effect) && d.lines === 2) { d.lines = 1; this.shadowRoot.getElementById("lines").value = "1"; }
        this._refreshPreview(); break;
      case "lines":
        d.lines = el.value === "2" ? 2 : 1;
        if (d.lines === 2 && !PAGED.includes(d.effect)) { d.effect = "fondu"; this.shadowRoot.getElementById("effect").value = "fondu"; this._toast(this._t.lines_effect); }
        this._refreshPreview(); break;
      case "speed": d.speed = el.value ? Number(el.value) : null; this._refreshPreview(); break;
      case "font": d.font = el.value; this._refreshPreview(); break;
      case "size": d.size = el.value ? Number(el.value) : 0; this._refreshPreview(); break;
      case "passes": d.passes = el.value ? Number(el.value) : null; break;
      case "aname": d.name = el.value; break;
      case "quiet": d.quiet = el.checked; this._render(); break;
      case "qfrom": if (el.value) d.quietFrom = el.value.slice(0, 5); break;
      case "qto": if (el.value) d.quietTo = el.value.slice(0, 5); break;
      case "cooldown": d.cooldown = Number(el.value) || 0; break;
      case "repeat": d.repeat = Number(el.value) || 0; break;
      case "ttime": if (el.value) d.time = el.value.slice(0, 5); break;
      case "formin": d.forMin = Number(el.value) || 0; break;
      case "threshold": d.threshold = el.value.trim(); break;
      case "sunoff": d.sunOffset = Number(el.value) || 0; break;
      case "calendar": d.calendar = el.value; break;
      case "caloff": d.calOffset = Number(el.value) || 0; break;
      case "calword": d.calWord = el.value; break;
      case "perevery": d.perEvery = Number(el.value) || 60; break;
      case "every": d.every = Number(el.value) === 2 ? 2 : 1; this._render(); break;
      case "parity": d.parity = Number(el.value) === 1 ? 1 : 0; break;
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
