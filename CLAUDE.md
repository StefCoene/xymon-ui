# xymon-ui

New Xymon web pages on the API of xymonapi. `README.md` says what they are,
what they need and what was checked.

- Xymon itself is never changed; what the pages need comes from the API.
- `xymon-plugins/` beside this file is a clone of its own (branch
  `xymon-ui`), ignored here, with its own `AGENTS.md`: no AI credit in
  commits there, and no push without being asked.
- No build step, and nothing loaded from elsewhere: plain ES modules, CSS
  and icons. Text that comes from Xymon never enters the page as HTML
  (`h()` in `ui/js/core.js`, `statusText()` in `ui/js/views.js`).
- This repository is public: nothing about a particular site belongs in
  it -- host names, addresses, a site's web server configuration.
- To try a change: `dev/jammy/run.sh`, then
  http://127.0.0.1:11986/xymon/ui/ (admin / admin).
- `ui/config.local.json` is the site's own and is not tracked.
