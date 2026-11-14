/* The pages. Each view returns {title, colour, node}: what the tab is
 * called, the colour of the page, and its content, built off the document
 * and put in place by app.js once it is whole.
 */
import {
	api, apiUrl, cfg, lists, prefs, isOwn, setPref, clearPrefs,
	COLOURS, COLUMN_ICONS, h, dot, ago, span, when
} from "./core.js";
import {
	board, colourOf, displayName, pageHosts, pageOfHost, statesOf, allStates, worst, counts,
	columnsOf, isNonGreen
} from "./model.js";

/* What survives a refresh of the same page: the summary card that filters,
 * and the change on the events page whose status text is open. */
export const ui = { filter: null, open: null };

const enc = encodeURIComponent;
const pageLink = (path) => (path ? "#/page/" + path.split("/").map(enc).join("/") : "#/");
const hostLink = (host) => "#/host/" + enc(host);
const statusLink = (host, test) => "#/status/" + enc(host) + "/" + enc(test);
const COLOUR_LABEL = { red: "Red", yellow: "Yellow", purple: "Purple", blue: "Blue", clear: "Clear", green: "Green" };

/* --- Shared pieces -------------------------------------------------------- */

const FILTERS = {
	recent: (st) => st.recent,
	ack: (st) => st.ack
};
for (const c of COLOURS) FILTERS[c] = (st) => st.colour === c;

/* A count per colour, and of the recent and the acknowledged; a click shows
 * only what has such a status, a second click everything again. */
function summary(states, onChange) {
	const c = counts(states);
	const bar = h("div", { class: "summary" });
	const card = (key, label, n, colour) => {
		const b = h("button", {
			type: "button",
			class: "card" + (n === 0 ? " zero" : "") + (ui.filter === key ? " active" : ""),
			style: colour ? "--c: var(--" + colour + ")" : null,
			title: "Show only what has " + label.toLowerCase() + " statuses; click again for everything",
			onclick: () => { ui.filter = ui.filter === key ? null : key; onChange(); }
		}, h("span", { class: "n" }, n), h("span", { class: "l" }, label));
		bar.append(b);
	};
	for (const colour of COLOURS) card(colour, COLOUR_LABEL[colour], c[colour], colour);
	card("recent", "Recent (" + (cfg.recentHours || 24) + "h)", c.recent, "link");
	card("ack", "Acked", c.ack, null);
	return bar;
}

function cell(host, test) {
	const tests = board.byHost.get(host), st = tests && tests.get(test);
	if (!st) return h("td", { class: "none" }, "-");
	const label = displayName(host) + " " + test + ": " + st.colour +
		(st.ack ? ", acknowledged" : "") + (st.time ? ", for " + ago(st.time) : "");
	/* The info, trends and client columns show their own icon while they
	 * are green, as Xymon's pages do: they are links, not measurements. */
	const icon = COLUMN_ICONS.includes(test) && st.colour === "green"
		? dot(test, { label })
		: dot(st.colour, { recent: st.recent, ack: st.ack, label });
	return h("td", null, h("a", { href: statusLink(host, test) }, icon));
}

/* A column's name, broken after each "-" as Xymon's own pages break it, so
 * that a long name makes a tall heading and not a wide column. */
function columnName(test) {
	const parts = test.split("-"), out = [];
	parts.forEach((part, i) => {
		if (i) out.push(h("br"));
		out.push(part + (i < parts.length - 1 ? "-" : ""));
	});
	return out;
}

/* One group: a table, hosts down and tests across. Each row remembers its
 * states, for the summary's filter. */
function grid(title, hosts, columns) {
	const body = h("tbody");
	for (const host of hosts) {
		const info = board.hosts[host] || {};
		/* A title line above a host in hosts.cfg: a heading inside the
		 * group, across the table, as xymongen draws it. */
		if (info.pretitle) {
			body.append(h("tr", { class: "htitle" }, h("td", { class: "htitle", colspan: columns.length + 1 }, info.pretitle)));
		}
		const row = h("tr", null,
			h("td", { class: "host" },
				h("a", { href: hostLink(host), title: host }, displayName(host)),
				info.comment ? h("span", { class: "comment" }, info.comment) : null),
			columns.map((t) => cell(host, t)));
		row.states = statesOf([host]).filter((st) => columns.includes(st.test));
		body.append(row);
	}
	return h("section", { class: "group" },
		h("table", { class: "grid" },
			h("thead", null, h("tr", null,
				h("th", { class: "gtitle" }, title || ""),
				columns.map((t) => h("th", { class: "col", title: t }, columnName(t))))),
			body));
}

/* Hide what the active summary card leaves out: rows, then groups whose
 * rows are all hidden, and subpages with nothing of the kind. */
function applyFilter(root) {
	const test = ui.filter && FILTERS[ui.filter];
	for (const row of root.querySelectorAll("table.grid tbody tr")) {
		row.classList.toggle("filtered", !!test && !(row.states || []).some(test));
	}
	for (const g of root.querySelectorAll(".group")) {
		const rows = g.querySelectorAll("tbody tr");
		g.classList.toggle("filtered", !!test && rows.length > 0 && ![...rows].some((r) => !r.classList.contains("filtered")));
	}
	for (const li of root.querySelectorAll(".subpages li")) {
		li.classList.toggle("filtered", !!test && !(li.states || []).some(test));
	}
}

/* Where a page is: the pages above it, each a link, down to this one.
 * TAIL adds what is below the page -- a host, then one of its tests -- as
 * [name, address] pairs; the last of all is where the reader is, and no link. */
function crumbs(page, tail) {
	const items = [];
	for (let p = page; p; p = p.parent) items.unshift([p.path ? (p.title || p.name) : "Top", pageLink(p.path)]);
	items.push(...(tail || []));
	const nav = h("nav", { class: "crumbs", "aria-label": "Page" });
	items.forEach(([name, href], i) => {
		if (i) nav.append(" / ");
		nav.append(i === items.length - 1 ? h("span", { class: "here" }, name) : h("a", { href }, name));
	});
	return nav;
}

function countWords(states) {
	const c = counts(states), parts = [];
	for (const colour of ["red", "yellow", "purple"]) if (c[colour]) parts.push(c[colour] + " " + colour);
	return parts.join(", ");
}

/* --- The board: one page of hosts.cfg ------------------------------------ */

export function boardView(path, rerender) {
	const page = board.byPath.get(path);
	if (!page) return { title: "No such page", colour: "clear", node: h("p", { class: "error" }, "hosts.cfg has no page " + path + ".") };
	const states = statesOf(pageHosts(page, true));
	const node = h("div", null, crumbs(page), summary(states, rerender));

	if (page.pages.length) {
		const list = h("ul", { class: "subpages" });
		for (const sub of page.pages) {
			const s = statesOf(pageHosts(sub, true));
			const li = h("li", null, h("a", { href: pageLink(sub.path) },
				dot(worst(s), { label: (sub.title || sub.name) + ": " + worst(s) }),
				h("span", null, sub.title || sub.name),
				countWords(s) ? h("span", { class: "counts" }, countWords(s)) : null));
			li.states = s;
			list.append(li);
		}
		node.append(list);
	}
	for (const g of page.groups) {
		if (!g.hosts.length) continue;
		if (g.pretitle) node.append(h("div", { class: "pretitle" }, g.pretitle));
		node.append(grid(g.title, g.hosts, columnsOf(g.hosts, g.only, g.except)));
	}
	if (!page.pages.length && !page.groups.some((g) => g.hosts.length)) {
		node.append(h("p", { class: "note" }, "This page has no hosts."));
	}
	applyFilter(node);
	return { title: page.path ? (page.title || page.name) : "Board", colour: worst(states), node };
}

/* --- Every host with something red, yellow or purple --------------------- */

export function nonGreenView(rerender) {
	const states = allStates();
	const hosts = [...board.byHost.keys()].filter((host) => statesOf([host]).some(isNonGreen)).sort();
	const columns = columnsOf(hosts).filter((t) => hosts.some((host) => {
		const st = board.byHost.get(host).get(t);
		return st && isNonGreen(st);
	}));
	const node = h("div", null, h("h1", null, "All non-green statuses"), summary(states, rerender));
	node.append(hosts.length
		? grid(hosts.length + (hosts.length === 1 ? " host" : " hosts"), hosts, columns)
		: h("p", { class: "note" }, "Everything is green."));
	applyFilter(node);
	return { title: "Non-green", colour: worst(states), node };
}

/* --- Hosts by name -------------------------------------------------------- */

export function findView(text) {
	const q = text.toLowerCase();
	const hosts = [...board.byHost.keys()]
		.filter((host) => host.toLowerCase().includes(q) || displayName(host).toLowerCase().includes(q)).sort();
	const node = h("div", null, h("h1", null, "Hosts matching “" + text + "”"));
	node.append(hosts.length ? grid(hosts.length + (hosts.length === 1 ? " host" : " hosts"), hosts, columnsOf(hosts))
		: h("p", { class: "note" }, "No host has that in its name."));
	return { title: "Find " + text, colour: worst(statesOf(hosts)), node };
}

/* --- One host ------------------------------------------------------------- */

export function hostView(host) {
	const tests = board.byHost.get(host);
	if (!tests) return { title: host, colour: "clear", node: h("p", { class: "error" }, "The board has no host " + host + ".") };
	const info = board.hosts[host] || {}, states = [...tests.values()];
	const order = columnsOf([host]);
	const body = h("tbody");
	for (const t of order) {
		const st = tests.get(t);
		body.append(h("tr", null,
			h("td", null, h("a", { href: statusLink(host, t) }, dot(st.colour, { recent: st.recent, ack: st.ack }))),
			h("td", null, h("a", { href: statusLink(host, t) }, t)),
			h("td", null, st.colour + (st.ack ? ", acknowledged" : "")),
			h("td", { class: "num", title: st.time ? when(st.time) : null }, st.time ? ago(st.time) : "")));
	}
	const node = h("div", null,
		crumbs(pageOfHost(host), [[displayName(host), hostLink(host)]]),
		h("div", { class: "status-head" },
			dot(worst(states)),
			h("h1", null, displayName(host)),
			h("span", { class: "meta" }, [displayName(host) !== host ? host : null, info.comment, info.description].filter(Boolean).join(" · "))),
		h("table", { class: "list" },
			h("thead", null, h("tr", null, h("th"), h("th", null, "Test"), h("th", null, "Status"), h("th", null, "For"))),
			body));
	return { title: displayName(host), colour: worst(states), node };
}

/* --- One status ----------------------------------------------------------- */

/* A status text as Xymon's own page shows it, made safe: "&red" and the
 * other colour marks become icons, and of the HTML a status may carry only
 * plain structure is kept -- no script, no style, no attribute but a link's
 * address and a cell's span. */
const KEEP = new Set(("A B I U EM STRONG BR P PRE TABLE THEAD TBODY TR TD TH HR UL OL LI H1 H2 H3 H4 H5 H6 " +
	"CENTER DIV SPAN FONT CODE TT SMALL BIG BLOCKQUOTE CAPTION").split(" "));
const DROP = new Set("SCRIPT STYLE IFRAME OBJECT EMBED FORM INPUT BUTTON SELECT TEXTAREA LINK META HEAD TITLE NOSCRIPT SVG MATH".split(" "));
const MARK = /(red|yellow|purple|blue|clear|green)/g;
const ICON_FILE = /(?:^|\/)(red|yellow|purple|blue|clear|green|unknown)(-recent|-ack)?\.(?:gif|png|svg|jpe?g)$/;

function marked(text, out) {
	let last = 0, m;
	MARK.lastIndex = 0;
	while ((m = MARK.exec(text))) {
		if (m.index > last) out.append(text.slice(last, m.index));
		out.append(dot(m[1]));
		last = MARK.lastIndex;
	}
	if (last < text.length) out.append(text.slice(last));
}

function safeCopy(from, out) {
	for (const n of from.childNodes) {
		if (n.nodeType === Node.TEXT_NODE) { marked(n.nodeValue, out); continue; }
		if (n.nodeType !== Node.ELEMENT_NODE) continue;
		const tag = n.tagName.toUpperCase();
		if (DROP.has(tag)) continue;
		if (tag === "IMG") {
			const m = ICON_FILE.exec((n.getAttribute("src") || "").split("?")[0]);
			if (m) out.append(dot(m[1], { recent: m[2] === "-recent", ack: m[2] === "-ack" }));
			continue;
		}
		if (!KEEP.has(tag)) { safeCopy(n, out); continue; }
		const e = document.createElement(tag === "FONT" || tag === "CENTER" ? "span" : tag.toLowerCase());
		if (tag === "A") {
			const href = n.getAttribute("href") || "";
			if (/^(https?:\/\/|\/|\.\.?\/|[^:]*$)/i.test(href)) {
				e.setAttribute("href", href);
				e.setAttribute("rel", "noopener noreferrer");
				e.setAttribute("target", "_blank");
			}
		}
		if (tag === "TD" || tag === "TH") {
			for (const a of ["colspan", "rowspan"]) {
				if (/^[0-9]{1,3}$/.test(n.getAttribute(a) || "")) e.setAttribute(a, n.getAttribute(a));
			}
		}
		safeCopy(n, e);
		out.append(e);
	}
}

export function statusText(text) {
	const out = h("div", { class: "status-text" });
	const src = String(text || "").replace(/&(red|yellow|purple|blue|clear|green)\b/g, "$1");
	if (!/<[A-Za-z!/]/.test(src)) { marked(src, out); return out; }
	safeCopy(new DOMParser().parseFromString(src, "text/html").body, out);
	return out;
}

const RANGES = [["24 hours", "-24h"], ["7 days", "-7d"], ["30 days", "-30d"], ["1 year", "-52w"]];

function graph(host, test) {
	const img = h("img", { alt: "Graph of " + host + " " + test, loading: "lazy" });
	const box = h("section", { class: "graph" }, h("h2", null, "Graph"));
	const buttons = h("div", { class: "actions" });
	const show = (from, b) => {
		img.src = apiUrl("/graphs", { entity: host, test, from });
		for (const x of buttons.children) x.classList.toggle("on", x === b);
	};
	for (const [label, from] of RANGES) {
		const b = h("button", { type: "button", class: "plain", onclick: () => show(from, b) }, label);
		buttons.append(b);
	}
	/* No graph for this test, or showgraph not reachable: nothing to show. */
	img.addEventListener("error", () => box.remove());
	box.append(buttons, img);
	show(RANGES[0][1], buttons.firstChild);
	return box;
}

/* The status text Xymon saved at a change, as a node that fills in once read.
 * A saved text never changes, so each is read once. */
const saved = new Map();
function savedStatus(host, test, ev) {
	const key = host + "\n" + test + "\n" + ev.epoch;
	const box = h("div", null, h("p", { class: "note" }, "Loading…"));
	if (!saved.has(key)) {
		const p = api("/histlog", { entity: host, test, time: ev.epoch });
		p.catch(() => saved.delete(key));	/* not kept: try again next time */
		saved.set(key, p);
	}
	saved.get(key).then(
		(log) => box.replaceChildren(h("h2", null, "Status at " + when(Date.parse(ev.time))), statusText(log.text)),
		(e) => box.replaceChildren(h("p", { class: "note" }, "No status text was saved at this change: " + e.message)));
	return box;
}

function history(host, test, events) {
	const body = h("tbody"), shown = h("div");
	for (const ev of events) {
		const row = h("tr", { class: "pick", title: "Show the status text saved at this change" },
			h("td", { class: "num" }, when(Date.parse(ev.time))),
			h("td", null, dot(colourOf(ev.previous)), " → ", dot(colourOf(ev.verdict))),
			h("td", null, colourOf(ev.verdict)),
			h("td", { class: "num" }, ev.previous_duration !== null && ev.previous_duration !== undefined
				? "after " + span(ev.previous_duration) + " " + colourOf(ev.previous) : ""));
		row.addEventListener("click", () => shown.replaceChildren(savedStatus(host, test, ev)));
		body.append(row);
	}
	return h("section", null, h("h2", null, "History"),
		h("table", { class: "list" },
			h("thead", null, h("tr", null, h("th", null, "When"), h("th", null, "Change"), h("th", null, "Colour"), h("th", null, "Before"))),
			body),
		shown);
}

export async function statusView(host, test) {
	const [st, ev] = await Promise.all([
		api("/status", { entity: host, test }),
		api("/events", { entity: host, test, limit: 25 }).catch(() => ({ items: [] }))
	]);
	const colour = colourOf(st.verdict);
	const since = st.time ? Date.parse(st.time) : 0, updated = st.updated ? Date.parse(st.updated) : 0;
	const acked = !!st.acknowledged;
	const recent = !!since && Date.now() - since < (cfg.recentHours || 24) * 3600e3;
	const node = h("div", null,
		crumbs(pageOfHost(host), [[displayName(host), hostLink(host)], [test, statusLink(host, test)]]),
		h("div", { class: "status-head" },
			dot(colour, { recent, ack: acked }),
			h("h1", null, displayName(host) + " · " + test),
			h("span", { class: "meta" },
				colour + (since ? " for " + ago(since) : "") + (updated ? " · updated " + ago(updated) + " ago" : ""))));

	if (cfg.cgi) {
		const cgi = cfg.cgi.replace(/\/+$/, "");
		node.append(h("div", { class: "actions" },
			h("a", { href: cgi + "/svcstatus.sh?HOST=" + enc(host) + "&SERVICE=" + enc(test), target: "_blank", rel: "noopener" },
				"Classic page: acknowledge, disable, history")));
	}
	if (st.acknowledged) {
		node.append(h("div", { class: "box ack" }, h("b", null, "Acknowledged"),
			st.acknowledged.until ? " until " + when(Date.parse(st.acknowledged.until)) : "",
			st.acknowledged.text ? ": " + st.acknowledged.text : ""));
	}
	if (st.disabled) {
		node.append(h("div", { class: "box disabled" }, h("b", null, "Disabled"),
			st.disabled.until ? " until " + when(Date.parse(st.disabled.until)) : "",
			st.disabled.text ? ": " + st.disabled.text : ""));
	}
	node.append(st.text && st.text.trim() ? statusText(st.text)
		: h("p", { class: "note" }, "This status has no text" + (COLUMN_ICONS.includes(test) ? ": Xymon's own page draws this column." : ".")));
	if (!COLUMN_ICONS.includes(test)) node.append(graph(host, test));
	if (ev.items && ev.items.length) node.append(history(host, test, ev.items));
	return { title: displayName(host) + " " + test, colour, node };
}

/* --- The latest colour changes -------------------------------------------- */

export async function eventsView() {
	const ev = await api("/events", { limit: 200 });
	const body = h("tbody");
	/* A click on a change opens the status text saved at it in a row of its
	 * own beneath, and a second click closes it again. */
	for (const e of ev.items || []) {
		const key = e.entity + "\n" + e.test + "\n" + e.epoch;
		const row = h("tr", { class: "pick", title: "Show the status text saved at this change" },
			h("td", { class: "num" }, when(Date.parse(e.time))),
			h("td", null, h("a", { href: hostLink(e.entity) }, displayName(e.entity))),
			h("td", null, h("a", { href: statusLink(e.entity, e.test) }, e.test)),
			h("td", null, dot(colourOf(e.previous)), " → ", dot(colourOf(e.verdict))),
			h("td", { class: "num" }, e.previous_duration !== null && e.previous_duration !== undefined ? span(e.previous_duration) : ""));
		const open = () => {
			const detail = h("tr", { class: "detail" }, h("td", { colspan: 5 }, savedStatus(e.entity, e.test, e)));
			row.after(detail);
			row.classList.add("open");
			return detail;
		};
		let detail = ui.open === key ? open() : null;
		row.addEventListener("click", (c) => {
			if (c.target.closest("a")) return;	/* the host and test links go to their pages */
			if (detail) {
				detail.remove();
				detail = null;
				row.classList.remove("open");
				ui.open = null;
				return;
			}
			for (const other of body.querySelectorAll("tr.open")) other.click();
			detail = open();
			ui.open = key;
		});
		body.append(row);
		if (detail) body.append(detail);
	}
	const node = h("div", null, h("h1", null, "Events"),
		(ev.items || []).length
			? h("table", { class: "list" },
				h("thead", null, h("tr", null, h("th", null, "When"), h("th", null, "Host"), h("th", null, "Test"),
					h("th", null, "Change"), h("th", null, "Was for"))),
				body)
			: h("p", { class: "note" }, "No status has changed colour yet."));
	return { title: "Events", colour: worst(allStates()), node };
}

/* --- Look and feel --------------------------------------------------------- */

/* The layout, the icon set, whether icons move, and how often the pages
 * refresh: the server's default, or this browser's own choice over it. A
 * change applies at once and is kept in this browser only. */
export function lookAndFeelView(changed) {
	const p = prefs();
	const from = (key) => h("span", { class: "from" }, isOwn(key) ? "this browser's choice; the server's default is " + cfg.defaults[key]
		: "the server's default");
	const select = (key, options) => {
		const s = h("select", { id: "lf-" + key, onchange: () => { setPref(key, s.value); changed(); } },
			options.map((o) => h("option", { value: o, selected: o === p[key] }, o)));
		return s;
	};
	const anim = h("input", { type: "checkbox", id: "lf-animation", checked: p.animation,
		onchange: () => { setPref("animation", anim.checked); changed(); } });
	const refresh = h("input", { type: "number", id: "lf-refresh", min: 10, max: 3600, step: 10, value: p.refresh,
		onchange: () => { if (setPref("refresh", parseInt(refresh.value, 10))) changed(); } });

	const preview = h("table", { class: "preview" },
		h("thead", null, h("tr", null, h("th"), COLOURS.map((c) => h("th", null, c)))),
		h("tbody", null,
			[["Status", {}], ["Changed recently", { recent: true }], ["Acknowledged", { ack: true }]].map(([label, opt]) =>
				h("tr", null, h("th", { class: "row" }, label), COLOURS.map((c) => h("td", null, dot(c, opt))))),
			h("tr", null, h("th", { class: "row" }, "Columns"),
				COLUMN_ICONS.map((c) => h("td", { title: c }, dot(c))))));

	const node = h("div", null,
		h("h1", null, "Look and feel"),
		h("p", { class: "note", style: "margin-left:0" },
			"What you choose here is kept in this browser and changes nothing on the server. " +
			"The server's defaults are in config.json beside these pages."),
		h("div", { class: "lf" },
			h("label", { for: "lf-layout" }, "Layout"), h("div", null, select("layout", lists.layouts), " ", from("layout")),
			h("label", { for: "lf-skin" }, "Icons"), h("div", null, select("skin", lists.skins), " ", from("skin")),
			h("label", { for: "lf-animation" }, "Moving icons"), h("div", null, anim, " ", from("animation")),
			h("label", { for: "lf-refresh" }, "Refresh every"), h("div", null, refresh, " seconds ", from("refresh"))),
		preview,
		h("div", { class: "actions" },
			h("button", { type: "button", class: "plain", onclick: () => { clearPrefs(); changed(); } }, "Use the server's defaults")));
	return { title: "Look and feel", colour: worst(allStates()), node };
}
