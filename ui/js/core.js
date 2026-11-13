/* Configuration, the browser's own choices, the API, and the status icons.
 *
 * Two levels decide how the pages look. The server's: config.json, shipped,
 * and config.local.json beside it, the site's own, which an update leaves
 * alone. The browser's: what the Look and feel page stores in localStorage,
 * which wins over the server's for that browser only.
 */

export const cfg = {
	title: "Xymon",
	api: "../api/v1",	/* relative to these pages, or a full URL */
	cgi: "",		/* Xymon's own CGI programs; empty hides the links to them */
	classic: "",		/* Xymon's own pages; empty hides the link */
	recentHours: 24,
	defaults: { layout: "classic", skin: "classic", animation: true, refresh: 60 }
};
export const lists = { layouts: ["classic"], skins: ["classic", "text"] };

export const COLOURS = ["red", "yellow", "purple", "blue", "clear", "green"];
export const COLUMN_ICONS = ["info", "trends", "clientlog"];
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const KEY = "xymon-ui.prefs";

async function getJSON(url) {
	const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
	if (!r.ok) throw new Error(url + " answered " + r.status);
	return r.json();
}

function names(list, fallback) {
	const ok = Array.isArray(list) ? list.filter((n) => typeof n === "string" && NAME.test(n)) : [];
	return ok.length ? ok : fallback;
}

export async function loadConfig() {
	const base = await getJSON("config.json");
	let local = {};
	try { local = await getJSON("config.local.json"); } catch (e) { /* none: the shipped settings stand */ }
	const defaults = Object.assign({}, cfg.defaults, base.defaults, local.defaults);
	Object.assign(cfg, base, local, { defaults });
	lists.layouts = names(await getJSON("layouts/index.json").catch(() => null), lists.layouts);
	lists.skins = names(await getJSON("skins/index.json").catch(() => null), lists.skins);
}

/* --- The browser's own choices ------------------------------------------ */

function stored() {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) || "{}");
		return v && typeof v === "object" ? v : {};
	} catch (e) {
		return {};		/* no storage, or not ours: the server's defaults */
	}
}

function valid(key, value) {
	if (key === "layout") return lists.layouts.includes(value);
	if (key === "skin") return lists.skins.includes(value);
	if (key === "animation") return typeof value === "boolean";
	if (key === "refresh") return Number.isInteger(value) && value >= 10 && value <= 3600;
	return false;
}

/* What applies now: the server's defaults, with the browser's choices over them. */
export function prefs() {
	const p = Object.assign({}, cfg.defaults), own = stored();
	if (!valid("layout", p.layout)) p.layout = lists.layouts[0];
	if (!valid("skin", p.skin)) p.skin = lists.skins[0];
	if (!valid("refresh", p.refresh)) p.refresh = 60;
	p.animation = p.animation !== false;
	for (const k of Object.keys(p)) if (valid(k, own[k])) p[k] = own[k];
	/* And the address over both, for this one window and never stored:
	 * ?layout=minimal&skin=text&animation=0&refresh=30 on a wall screen. */
	const q = new URLSearchParams(window.location.search);
	for (const k of ["layout", "skin"]) if (valid(k, q.get(k))) p[k] = q.get(k);
	if (q.get("animation") === "0" || q.get("animation") === "1") p.animation = q.get("animation") === "1";
	if (valid("refresh", parseInt(q.get("refresh"), 10))) p.refresh = parseInt(q.get("refresh"), 10);
	return p;
}

/* Whether this browser overrides the server's default for KEY. */
export function isOwn(key) {
	return valid(key, stored()[key]);
}

export function setPref(key, value) {
	if (!valid(key, value)) return false;
	const own = stored();
	own[key] = value;
	try { localStorage.setItem(KEY, JSON.stringify(own)); } catch (e) { return false; }
	return true;
}

export function clearPrefs() {
	try { localStorage.removeItem(KEY); } catch (e) { /* nothing was stored */ }
}

/* --- The API ------------------------------------------------------------- */

export function apiUrl(path, params) {
	const u = new URL(cfg.api.replace(/\/+$/, "") + path, window.location.href);
	for (const [k, v] of Object.entries(params || {})) {
		if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
	}
	return u.toString();
}

export async function api(path, params) {
	let r;
	try {
		r = await fetch(apiUrl(path, params), { credentials: "same-origin", headers: { Accept: "application/json" } });
	} catch (e) {
		throw new Error("the Xymon API at " + cfg.api + " cannot be reached");
	}
	if (!r.ok) {
		let detail = "";
		try { detail = (await r.json()).detail || ""; } catch (e) { /* not the API's own answer */ }
		const err = new Error(detail || "the Xymon API answered " + r.status);
		err.status = r.status;
		throw err;
	}
	return r.json();
}

/* --- DOM ----------------------------------------------------------------- */

/* h("a", {href: "#/", class: "x"}, "text", node ...): text is never markup. */
export function h(tag, attrs, ...children) {
	const e = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (v === undefined || v === null || v === false) continue;
		if (k === "class") e.className = v;
		else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
		else e.setAttribute(k, v === true ? "" : v);
	}
	for (const c of children.flat()) {
		if (c === undefined || c === null || c === false) continue;
		e.append(c instanceof Node ? c : document.createTextNode(String(c)));
	}
	return e;
}

/* --- Layout and icons ---------------------------------------------------- */

const CHARS = { green: "✓", yellow: "▲", red: "✕", purple: "◆", clear: "○", blue: "⊘", unknown: "?" };
const COLUMN_CHARS = { info: "i", trends: "↗", clientlog: "≡", arrow: "→", zoom: "⌕" };
const TEXT_SKIN = { name: "text", type: "text", icons: new Set(), still: new Set() };
let skin = TEXT_SKIN;

/* Put the layout and the icon set that apply now in place. */
export async function applyLook() {
	const p = prefs();
	const link = document.getElementById("layout-css");
	const href = "layouts/" + p.layout + "/layout.css";
	if (link.getAttribute("href") !== href) link.setAttribute("href", href);
	document.body.classList.toggle("animated", p.animation);
	document.body.dataset.layout = p.layout;
	if (p.skin === "text") { skin = TEXT_SKIN; return; }
	if (skin.name === p.skin) return;
	try {
		const m = await getJSON("skins/" + p.skin + "/skin.json");
		skin = { name: p.skin, type: String(m.type || "gif"), icons: new Set(m.icons || []), still: new Set(m.static || []) };
	} catch (e) {
		skin = TEXT_SKIN;	/* an icon set that is not there: characters always are */
	}
}

function file(name) {
	const still = !prefs().animation && skin.still.has(name);
	return "skins/" + skin.name + "/" + (still ? "static/" : "") + name + "." + skin.type;
}

/* The icon of a status -- a colour, "unknown", or a column's own icon --
 * as the icon set draws it: <colour>-ack when acknowledged, <colour>-recent
 * when it changed recently, where the set has them. In characters, the same
 * as classes on a <span>. */
export function dot(colour, opt) {
	opt = opt || {};
	let name = colour, words = colour;
	if (opt.ack) words += ", acknowledged";
	else if (opt.recent) words += ", changed recently";
	if (opt.ack && skin.icons.has(colour + "-ack")) name = colour + "-ack";
	else if (opt.recent && skin.icons.has(colour + "-recent")) name = colour + "-recent";
	const cls = "dot dot-" + colour + (opt.recent ? " dot-recent" : "") + (opt.ack ? " dot-ack" : "");
	const label = opt.label || words;
	if (skin.type === "text" || !skin.icons.has(name)) {
		return h("span", { class: cls, role: "img", "aria-label": label, title: label },
			CHARS[colour] || COLUMN_CHARS[colour] || "?");
	}
	return h("img", { class: cls, src: file(name), alt: label, title: label });
}

export function favicon(colour) {
	const set = skin.type === "text" ? "classic" : skin.name;
	const c = ["blue", "clear", "green", "purple", "red", "yellow"].includes(colour) ? colour : "unknown";
	return "skins/" + set + "/favicon-" + c + ".ico";
}

/* --- Times ---------------------------------------------------------------- */

export function ago(ms) {
	let s = Math.max(0, Math.round((Date.now() - ms) / 1000));
	return span(s);
}

export function span(s) {
	if (s < 60) return s + "s";
	if (s < 3600) return Math.floor(s / 60) + "m";
	if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
	return Math.floor(s / 86400) + "d " + Math.floor((s % 86400) / 3600) + "h";
}

export function when(ms) {
	return new Date(ms).toLocaleString();
}
