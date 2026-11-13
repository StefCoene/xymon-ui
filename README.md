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
- `xymonapi` with two additions these pages rely on, which are not in
  xymon-plugins yet: `/pages`, the page tree of `hosts.cfg`, and
  `acknowledged` and `disabled` in `/states`. They are on branch
  [`xymon-ui` of StefCoene/xymon-plugins](https://github.com/StefCoene/xymon-plugins/tree/xymon-ui),
  which also draws a graph without asking the web server for it, starts
  under the Xymon that Debian and Ubuntu package, and runs with Ubuntu
  22.04's own Python packages (fastapi 0.63, uvicorn 0.15).
- A current browser.

## Installing

The pages are plain files: the web server that serves Xymon's own pages
serves these too, and passes `/xymon/api/` on to the API, so that the
pages and the API they read are at one address. On the Xymon server, with
the API installed from the branch above (`./install.sh install-server
xymonapi`, see its README), copy `ui/` to where the web server may read
it, and for Apache, with mod_proxy, mod_proxy_http and mod_headers:

```apache
Alias "/xymon/ui" "/usr/local/share/xymon-ui"
<Directory "/usr/local/share/xymon-ui">
   Require all granted
   Header set Cache-Control "no-cache"
</Directory>
<Location "/xymon/api/">
   ProxyPass "http://127.0.0.1:1986/xymon/api/"
   ProxyPassReverse "http://127.0.0.1:1986/xymon/api/"
</Location>
```

- The `Alias` must be read before Xymon's own `Alias /xymon`, which
  otherwise takes the path: on Debian and Ubuntu a file named
  `conf-available/xymon-ui.conf` is, since it sorts before `xymon.conf`.
- `Cache-Control: no-cache` makes a browser ask again for each file, and
  get a short 304 while it is the same; without it a browser goes on using
  a stylesheet or a script it kept, after an update.
- `Require all granted` is for the example: give the pages the access
  rules Xymon's own pages have. The API checks its own password, when it
  has one, whatever the web server asks.

### Without a web server

The API of the branch above can serve the pages itself, which is how the
test container below runs them and enough for a look through an SSH
tunnel: copy `ui/` to `$XYMONHOME/ext/xymon-ui` and restart the API. The
pages are then at `/xymon/ui/` on the API's own port, behind its password
check, with the same `Cache-Control`. This is a convenience of that
branch and is not proposed for xymon-plugins.

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
