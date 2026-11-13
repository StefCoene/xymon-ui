# xymon-ui

New web pages for [Xymon](https://github.com/xymon-monitoring/xymon), read
from the Xymon API (`xymonapi`, one of the
[xymon-plugins](https://github.com/xymon-monitoring/xymon-plugins)). Xymon
itself is not changed: the server, its own pages and its CGI programs stay
as they are, and these pages run beside them.

This is early work. It runs on one home server and in the test container
below; see [What was checked](#what-was-checked).

## What it shows

- The board, page by page as `hosts.cfg` lays it out: groups as tables,
  hosts down and tests across, with a count per colour that filters.
- Everything that is not green, one host, one status with its text, graph
  and history, the latest colour changes, and hosts found by name.
- **Layouts** -- classic, modern, minimal -- and **icon sets** -- classic
  (Xymon's own), accessible, vector, and one drawn in characters. The
  server sets a default; each browser can choose its own on the Look and
  feel page.

No build step and nothing loaded from elsewhere: plain HTML, CSS, ES
modules and icons, served from one directory.

Acknowledging and disabling are not here: the API only reads. A status
page links to Xymon's own page for them.

## What it needs

- A Xymon server, unmodified. Tried with 4.3.30 as Ubuntu 22.04 packages it,
  and with a 4.3.31.
- `xymonapi` with four additions these pages rely on, which are not in
  xymon-plugins yet: branch
  [`xymon-ui` of StefCoene/xymon-plugins](https://github.com/StefCoene/xymon-plugins/tree/xymon-ui).
  They are: `/pages`, the page tree of `hosts.cfg`; `acknowledged` and
  `disabled` in `/states`; serving these pages at `/xymon/ui/`; and three
  fixes for Ubuntu 22.04's own Python packages (fastapi 0.63, uvicorn 0.15).
- A current browser.

## Installing

On the Xymon server, as the Xymon user, with the API installed from the
branch above (`./install.sh install-server xymonapi`, see its README):

```sh
cp -r ui "$XYMONHOME/ext/xymon-ui"
```

Restart the API (stop it; xymonlaunch starts it again). It then serves the
pages at `/xymon/ui/` on its own port, behind the same password check as
the API. To reach them through the web server, pass `/xymon/ui/` and
`/xymon/api/` on to the API; for Apache:

```apache
<Location "/xymon/api/">
   ProxyPass "http://127.0.0.1:1986/xymon/api/"
   ProxyPassReverse "http://127.0.0.1:1986/xymon/api/"
</Location>
<Location "/xymon/ui/">
   ProxyPass "http://127.0.0.1:1986/xymon/ui/"
   ProxyPassReverse "http://127.0.0.1:1986/xymon/ui/"
</Location>
```

The pages can also be served by any web server as plain files, with `api`
in the configuration naming where the API is, on the same origin.

## Settings

Four levels, each over the one before:

| where | whose | holds |
|---|---|---|
| `ui/config.json` | shipped | every setting and its default |
| `ui/config.local.json` | the site's; an update leaves it alone | the same keys, those that differ |
| the Look and feel page | one browser's, in its localStorage | layout, icons, moving icons, refresh |
| the address | one window's, never stored | `?layout=minimal&skin=text&animation=0&refresh=30`, for a wall screen |

The keys of `config.json`: `title`; `api`, the API's address, relative to
the pages or a full URL; `cgi` and `classic`, where Xymon's own CGI
programs and pages are, empty to hide the links to them; `recentHours`,
how long a change counts as recent; and `defaults`, with `layout`, `skin`,
`animation` and `refresh` in seconds.

## Adding a layout or an icon set

A layout is one stylesheet, `ui/layouts/NAME/layout.css`, loaded after
`ui/css/base.css`: it overrides the custom properties there -- colours,
fonts, the size of an icon -- and whatever else it wants. Add its name to
`ui/layouts/index.json`.

An icon set is a directory `ui/skins/NAME/` with a `skin.json`;
[`ui/skins/README`](ui/skins/README) says what it holds. Add its name to
`ui/skins/index.json`.

## The test container

`dev/jammy/run.sh` builds and starts Ubuntu 22.04 with the distribution's
own Xymon 4.3.30, Apache, the API installed from a clone of the branch
above in `xymon-plugins/` beside this file, these pages live from `ui/`,
and a board with every colour on it:

```sh
git clone -b xymon-ui https://github.com/StefCoene/xymon-plugins
dev/jammy/run.sh
# the pages and the API: http://127.0.0.1:11986/xymon/ui/   (admin / admin)
# Xymon's own pages:     http://127.0.0.1:18080/xymon/
```

## What was checked

In the container: every reading operation of the API, its password check
and socket, stopping and restarting under xymonlaunch, and each page drawn
in headless Chromium -- the three layouts, the four icon sets, a narrow
screen. On one real server: the board, a status with its graph and
history, through Apache.

Not checked: clicking -- the filter cards, a history line, the choices on
the Look and feel page; a browser's own password prompt; a large board;
the test suite of xymon-plugins against the API's additions.

## Licence

GNU General Public License version 2, as Xymon: see [LICENSE](LICENSE).
The classic icon set is Xymon's own; [`ui/skins/README`](ui/skins/README)
says whose each set is.
