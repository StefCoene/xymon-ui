/* The Xymon pages on the Xymon API: start, route, refresh.
 *
 * Every address is a fragment, so the pages are plain files that any web
 * server, or the API itself, can serve from one directory:
 *   #/                 the top page          #/page/A/B     a page of hosts.cfg
 *   #/nongreen         all that is not green #/events       the colour changes
 *   #/host/H           one host              #/status/H/T   one status
 *   #/find/TEXT        hosts by name         #/lookandfeel  layout and icons
 */
import { cfg, loadConfig, prefs, applyLook, favicon, h } from "./core.js";
import { board, loadBoard } from "./model.js";
import * as views from "./views.js";

const main = document.getElementById("main");
const refreshBox = document.getElementById("refresh");
const find = document.getElementById("find");
let left = 0;			/* seconds to the next refresh */
let problem = null;		/* why the last refresh failed, or null */
let drawing = 0;		/* the newest draw: an older one that ends later is dropped */
let lastRoute = "";

function route() {
	const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((p) => {
		try { return decodeURIComponent(p); } catch (e) { return p; }
	});
	return { view: parts[0] || "page", args: parts.slice(1) };
}

async function build(r) {
	const again = () => draw();
	switch (r.view) {
	case "page": return views.boardView(r.args.join("/"), again);
	case "nongreen": return views.nonGreenView(again);
	case "find": return views.findView(r.args.join("/"));
	case "host": return views.hostView(r.args[0] || "");
	case "status": return views.statusView(r.args[0] || "", r.args.slice(1).join("/"));
	case "events": return views.eventsView();
	case "lookandfeel": return views.lookAndFeelView(async () => { await applyLook(); left = Math.min(left, prefs().refresh); draw(); });
	default: return { title: "Not found", colour: "clear", node: h("p", { class: "error" }, "There is no such page here.") };
	}
}

async function draw() {
	const mine = ++drawing, r = route(), key = window.location.hash;
	if (key !== lastRoute) { views.ui.filter = null; lastRoute = key; }
	let out;
	try {
		if (!board.root) throw problem || new Error("the board has not been read yet");
		out = await build(r);
	} catch (e) {
		out = { title: "Error", colour: "clear", node: h("p", { class: "error" }, "Xymon could not be read: " + e.message + ".") };
	}
	if (mine !== drawing) return;
	main.replaceChildren(out.node);
	document.body.className = document.body.className.replace(/\bpage-[a-z]+\b/g, "").trim() + " page-" + out.colour;
	document.title = out.colour + ": " + cfg.title + " – " + out.title;
	document.getElementById("favicon").href = favicon(out.colour);
	const current = { page: "board", host: "board", status: "board", find: "board" }[r.view] || r.view;
	for (const a of document.querySelectorAll("#menu a[data-view]")) a.classList.toggle("current", a.dataset.view === current);
	document.getElementById("bottom").textContent = board.loaded
		? "Board read " + new Date(board.loaded).toLocaleTimeString() + (problem ? " – the last refresh failed: " + problem.message : "")
		: "";
}

async function refresh() {
	refreshBox.textContent = "↻";
	try {
		await loadBoard();
		problem = null;
	} catch (e) {
		problem = e;
	}
	left = prefs().refresh;
	refreshBox.classList.toggle("stale", !!problem);
	await draw();
}

function tick() {
	if (left > 0 && --left === 0) { refresh(); return; }
	if (left > 0) refreshBox.textContent = "↻ " + left + "s";
}

async function start() {
	try {
		await loadConfig();
	} catch (e) {
		main.replaceChildren(h("p", { class: "error" }, "The pages' own config.json could not be read: " + e.message + "."));
		return;
	}
	document.getElementById("brand").textContent = cfg.title;
	if (cfg.classic) {
		const a = document.getElementById("classic-link");
		a.href = cfg.classic;
		a.hidden = false;
	}
	await applyLook();
	window.addEventListener("hashchange", () => { window.scrollTo(0, 0); draw(); });
	refreshBox.addEventListener("click", refresh);
	find.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;
		const text = find.value.trim();
		window.location.hash = text ? "#/find/" + encodeURIComponent(text) : "#/";
	});
	/* Another tab changed the look: follow it. */
	window.addEventListener("storage", async () => { await applyLook(); draw(); });
	setInterval(tick, 1000);
	await refresh();
}

start();
