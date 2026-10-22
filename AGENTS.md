# AGENTS.md

## Repo

- Name: **subzer0** (the GitHub repo is still `cd-wav/conv`)
- Remote: https://github.com/cd-wav/conv (private)
- Branch: `main` tracks `origin/main`
- Commit identity: `cd <256783022+cd-wav@users.noreply.github.com>`
- License: MIT

## Push workflow

The user works in VS Code. Do **not** commit or push automatically.

When the user says anything like:

- "push everything into github"
- "push it" / "push this"
- "commit and push"
- "back it up"

then:

1. `git status` / `git diff` to see what changed.
2. Stage changes (`git add -A`), excluding secrets, `.env`, `node_modules`, build output.
3. Commit with a short, descriptive, imperative message (e.g. `add csv parser`, `fix header rendering`).
4. `git push` to `origin main`.
5. Run `npm run publish:release` so a new setup build is attached to a GitHub release.

If the push fails (auth, conflicts, rejected non-fast-forward), stop and report
the error — do not force-push without explicit permission.

## What this project is

`subzer0` is a self-modifying desktop app. The window *is* the app: it opens as a
dark screen with one centered chat box, and a local OpenCode session edits that
same app while you talk to it. There is no preview pane and no generated
side-project. The interface is fully customizable — the AI can rewrite every
pixel of it. The only host control is a reset button (↺); there is no `Done`
button (export still exists as `window.conv.exportApp()`).

## Layout

| Path | Purpose |
| --- | --- |
| `electron/main.js` | Window, `preview://` protocol, session lifecycle, model pin, settings, IPC |
| `electron/opencode.js` | Bridge to the OpenCode HTTP API (pure Node, no Electron) |
| `electron/sandbox.js` | Creates/resets `sandbox/` from `electron/seed/` |
| `electron/preload.js` | `window.conv` bridge + shadow-DOM reset control + recovery chat |
| `electron/export.js` | Builds a standalone app folder (`resources/app` payload) |
| `electron/update.js` | Self-update: checks GitHub for a newer release, downloads + silently reinstalls |
| `installer/` | Setup wizard: copies its own runtime + payload, makes shortcuts; `--update` = silent reinstall |
| `electron/seed/` | Starting app: chat, settings dialog, two themes, plus its `AGENTS.md` |
| `assets/` | Generated icon (`subzer0.png`, `subzer0.ico`) |
| `scripts/smoke.mjs` | End-to-end test of the AI bridge, no UI |
| `scripts/build-setup.mjs` | Assembles `out/setup/subzer0 Setup.exe` (+ `--zip`) |
| `scripts/publish.mjs` | Builds zip + exe and publishes both as a GitHub release (the exe feeds the in-app updater) |
| `scripts/icon.mjs` | Renders the icon procedurally (PNG encoder + ICO container) |
| `scripts/stamp-icon.mjs` | Stamps icon + version info onto the setup exe (`resedit`) |

`sandbox/` is generated at runtime and gitignored. Never edit `sandbox/app`
directly to change the starting state — change `electron/seed/` instead.

## Commands

```sh
npm run dev              # electron .
npm run smoke            # verify the OpenCode bridge works
npm run icon             # regenerate assets/subzer0.{png,ico}
npm run setup            # build out/setup/subzer0 Setup.exe
npm run release          # build + zip for distribution
npm run publish:release  # build + upload the zip and setup exe to a GitHub release
```

Debugging the generated app (no devtools chrome in this app):

```powershell
$env:CONV_DEBUG_PORT="9222"; npm run dev
# then http://127.0.0.1:9222/json
```

## Architecture rules

- The window loads `preview://app/index.html` from `sandbox/app`. Reload after
  edits is debounced 500ms in `watchAppDir`/`queueReload`.
- Only one instance runs at a time: `app.requestSingleInstanceLock()` focuses the
  existing window on a second launch. Dev builds use a separate `userData` folder
  (`%APPDATA%\subzer0-dev`) so they never fight the installed build over the
  Chromium cache.
- `window.conv` is the fixed contract between app and host. The AI may rewrite
  everything else, and `electron/seed/AGENTS.md` forbids breaking it.
- The reset button lives in a shadow root injected by the preload so app CSS
  cannot break it.
- `preload.js` also installs a **recovery chat** if the app has not called
  `window.conv` 1.5s after load. This is a hard guarantee that the user can
  always reach the AI even if an edit drops the bridge. Do not remove it.
- Message history (user *and* assistant) is replayed from the server on every
  reload, so the app must render from `onUpdate` rather than keeping chat state
  that has to survive.
- The seed app always shows: the user's own messages, the assistant's replies,
  and (when enabled) a token meter under the input.
- The seed app ships 12 UI languages (en, ru, de, es, fr, pt, it, nl, pl, tr,
  uk, zh). Settings has a language select; every string goes through `t(key)` in
  `app.js` (`MESSAGES` table) and static markup uses `data-i18n`,
  `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria`. The choice is
  stored in `localStorage` (`subzer0.language`), not in `.conv.json`.
- Settings live in `sandbox/.conv.json` (`model`, `theme`, `showTokens`,
  `budget`, `sessionID`). They are pushed to the renderer with every `app:update`
  and survive reloads, restarts and app rewrites. There are exactly **two
  themes**: `dark` and `light`.
- Switching model or reasoning calls `client.session.switchModel({ sessionID,
  model })`, which keeps the conversation history. `models:list` returns all
  enabled models with a `plan` of `free` (every cost tier zero), `go`
  (`opencode-go` provider, subscription) or `paid` (metered), deduplicated by
  model id and cached 10s. There is no subscription endpoint, so Go status
  flips to `active`/`inactive` only after a Go model actually runs.
- Errors are translated by `electron/errors.js` (`explainError`) into
  `{ kind: 'limit' | 'plan' | 'auth' | 'error', message }`. The app shows the
  message and offers Settings on `limit`/`plan`. Keep that mapping in sync with
  the seed app, which relies on `kind`.
- Tokens are expensive: `electron/seed/AGENTS.md` is deliberately short, and
  `maybeCompact()` calls `session.compact` before a prompt once the conversation
  is estimated past ~60k tokens. Keep both.
- OpenCode does not have to be running. `Service.ensure` discovers a registered
  service or spawns `opencode-cli serve --service --port 0`, so a closed OpenCode
  is started in the background on a free port. Never kill OpenCode processes:
  that is the agent's own runtime.
- The setup wizard (`installer/`) is a separate Electron app. It copies its own
  runtime (excluding `resources/app` and `resources/payload`), renames the root
  exe to `subzer0.exe`, drops the exported payload into `resources/app`, and
  creates desktop + Start menu shortcuts. It never touches the network.
- Self-update: `window.conv.updates` + `electron/update.js` check the latest
  GitHub release via the `gh` CLI (auth is gh's own; the repo is private).
  `apply()` downloads the release's raw setup exe asset, runs it with
  `--update --install-dir=<dir>` and quits; the installer retries files locked
  by the exiting app, reinstalls in place and relaunches. The user's sandbox
  (app files, settings, sessions) is not part of the payload, so it survives
  updates. Exported standalone apps get stub `updates` methods.
- The icon is generated from code, not a binary asset. `scripts/build-setup.mjs`
  stamps it (plus version info) onto the setup exe, so the installed
  `subzer0.exe` inherits it.
- Exported standalone apps get a stub `window.conv` preload so they render
  instead of crashing; the composer tells the user there is no AI attached.

## Model

`electron/main.js` pins sessions to `opencode/deepseek-v4.1-flash-free`
(`DEFAULT_MODEL`). If session creation with that model fails, it re-creates the
session without a model so the user's configured default is used.

## OpenCode API notes

Verified against opencode 2.1.2. Keep these in mind, they are easy to get wrong:

- Client: `@opencode/client` → `OpenCode.make({ baseUrl, headers })`.
- Service discovery + auth: `@opencode/client/service` → `Service.ensure()` and
  `Service.headers(endpoint)`. Auth is HTTP Basic with the password from
  `~/.local/state/opencode/service.json` (or `$XDG_STATE_HOME`).
- Create session: `client.session.create({ location: { directory }, title, model })`.
  The location must be registered by creating a session **before** calling
  `client.model.default({ location })`, otherwise `LocationNotFoundError`.
- Prompt: `client.session.prompt({ sessionID, text })` — this only *admits* the
  input; it does not wait for completion.
- Messages: `client.message.list({ sessionID, order: 'asc', limit: 200 })`.
  Note it is `client.message.list`, **not** `client.session.message.list`.
  A user message's text is at the **top level** (`{ id, type: 'user', text }`),
  not under `payload.text`.
- Events: `client.event.subscribe()` (SSE, live-only, no replay). Completion
  arrives as `session.execution.succeeded` / `.failed` / `.interrupted` — not
  `session.idle`, which is rare in practice.
- Tokens: `client.session.get({ sessionID })` → `.tokens`
  `{ input, output, reasoning, cache }`.
- Interrupt: `client.session.interrupt({ sessionID })`.
- Compact: `client.session.compact({ sessionID })`.
- Permissions: config rules, not session rulesets. Default policy allows
  everything, so the sandbox *denies* what it does not need.

## Conventions

- No React, no CSS framework, no build step in the generated app — the agent
  edits plain HTML/CSS/JS and that keeps edits reliable.
- Never let the generated app touch Node APIs. The preview iframe is sandboxed
  (`allow-scripts` only) and served through the `preview://` protocol.
- Anything the agent may do must be reachable without shell access.
- The UI should look designed, not generated: hairlines, one accent, system
  fonts, no gradients or glow.

## History

The original converter app that used to live in this folder was deleted on
2026-10-21 and is unrecoverable; it is not part of this repo.

Today's date: Wed Oct 21 2026
