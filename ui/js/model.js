/* The board: the page tree of hosts.cfg (/pages) and one state per host and
 * test (/states), read together and kept until the next refresh.
 *
 * The API speaks in verdicts, never colours; the colour is how a page shows
 * a verdict, and this is where that is decided.
 */
import { api, cfg, COLUMN_ICONS } from "./core.js";

const VERDICT_COLOUR = { ok: "green", warning: "yellow", critical: "red", disabled: "blue", nodata: "clear", unknown: "purple" };
/* The colour of a page is that of its worst status; blue and clear do not
 * count, as on Xymon's own pages. */
const RANK = { red: 3, yellow: 2, purple: 1 };

export const board = {
	root: null,
	hosts: {},		/* name -> {name, comment, description} from hosts.cfg */
	byHost: new Map(),	/* name -> Map(test -> state) */
	byPath: new Map(),	/* page path -> page */
	loaded: 0
};

export function colourOf(verdict) {
	return VERDICT_COLOUR[verdict] || "purple";
}

export async function loadBoard() {
	const [pages, states] = await Promise.all([api("/pages"), api("/states")]);
	const now = Date.now(), recent = (cfg.recentHours || 24) * 3600e3;
	const byHost = new Map();
	for (const s of states.items || []) {
		const time = s.time ? Date.parse(s.time) : 0;
		const st = {
			host: s.entity, test: s.test, colour: colourOf(s.verdict), time,
			ack: !!s.acknowledged, disabled: !!s.disabled,
			recent: !!time && now - time < recent
		};
		if (!byHost.has(st.host)) byHost.set(st.host, new Map());
		byHost.get(st.host).set(st.test, st);
	}
	const byPath = new Map();
	(function index(page, parent) {
		page.parent = parent;
		byPath.set(page.path, page);
		for (const p of page.pages || []) index(p, page);
	})(pages.root, null);
	board.root = pages.root;
	board.hosts = pages.hosts || {};
	board.byHost = byHost;
	board.byPath = byPath;
	board.loaded = now;
}

export function displayName(host) {
	const info = board.hosts[host];
	return (info && info.name) || host;
}

/* The hosts of a page: its own groups', and with DEEP its subpages' too. */
export function pageHosts(page, deep) {
	const out = new Set();
	(function walk(p) {
		for (const g of p.groups || []) for (const host of g.hosts) out.add(host);
		if (deep) for (const sub of p.pages || []) walk(sub);
	})(page);
	return out;
}

export function statesOf(hosts) {
	const out = [];
	for (const host of hosts) {
		const tests = board.byHost.get(host);
		if (tests) for (const st of tests.values()) out.push(st);
	}
	return out;
}

export function allStates() {
	return statesOf(board.byHost.keys());
}

export function worst(states) {
	let best = "", rank = 0;
	for (const st of states) {
		if ((RANK[st.colour] || 0) > rank) { rank = RANK[st.colour]; best = st.colour; }
	}
	return best || (states.length ? "green" : "clear");
}

export function counts(states) {
	const c = { red: 0, yellow: 0, purple: 0, blue: 0, clear: 0, green: 0, recent: 0, ack: 0 };
	for (const st of states) {
		if (c[st.colour] !== undefined) c[st.colour]++;
		if (st.recent) c.recent++;
		if (st.ack) c.ack++;
	}
	return c;
}

/* The columns of a group: those group-only names, in its order; otherwise
 * every test one of its hosts has, without those group-except names, by
 * name, with the info, trends and client columns last. */
export function columnsOf(hosts, only, except) {
	if (only && only.length) return only.slice();
	const skip = new Set(except || []), seen = new Set();
	for (const host of hosts) {
		const tests = board.byHost.get(host);
		if (tests) for (const t of tests.keys()) if (!skip.has(t)) seen.add(t);
	}
	const last = (t) => (COLUMN_ICONS.includes(t) ? 1 : 0);
	return [...seen].sort((a, b) => last(a) - last(b) || a.localeCompare(b));
}

export function isNonGreen(st) {
	return st.colour === "red" || st.colour === "yellow" || st.colour === "purple";
}
