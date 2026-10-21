# subzer0

An AI app that rewrites itself.

You open it and get a quiet, dark, centered chat box. You tell the AI what you
want — "give me a sidebar", "make it look like a terminal" — and it edits the app
you are looking at. The window reloads and the change is there. Everything about
the interface is fair game, because the interface is just three files the AI can
rewrite.

No API keys. No model downloads. It drives [OpenCode](https://opencode.ai), the
coding agent on your machine, and picks up every model it can see — the free ones,
your **OpenCode Go** models, and metered models billed to your balance.
DeepSeek V4.1 Flash is the default, with its reasoning effort (`low` / `high` /
`max`) selectable. Dark or light theme, a token budget, and the token counter are
all in Settings, and everything persists.

If OpenCode is not running, subzer0 starts its own background service on a free
port — you never have to open the desktop app first.

## How it works

```
+-- the window is the app -----------------------------------+
|                                                            |
|   sandbox/app/{index.html,styles.css,app.js}                |
|   one centered column, chat, settings dialog                |
|                                                       (↺)  |  <- reset
+---------------------------+--------------------------------+
                            | window.conv  (preload bridge)
                            v
                    Electron main process
                            | HTTP + SSE (localhost, basic auth)
                            v
                    OpenCode background service
                            | edits real files
                            v
            sandbox/app/*  ->  file change  ->  window reloads
```

- The window loads `preview://app/index.html`, served straight from
  `sandbox/app` by a custom protocol handler. There is no preview pane — the app
  you see *is* the generated app.
- `window.conv` (in `electron/preload.js`) is the only fixed contract: `send`,
  `stop`, `reset`, `exportApp`, `settings`, `models`, `onUpdate`, `onSettings`,
  `onError`, `onSandboxChange`.
- No `Done` button: reset is the only host control. Export still exists as
  `window.conv.exportApp()` for anyone who wants to wire it up.
- `sandbox/AGENTS.md` is the brief the agent gets every session. It is kept short
  on purpose — it is paid for on every message.
- Every write triggers a debounced reload. Message history is replayed from the
  server, so nothing is lost, and the session id is persisted across restarts.
- When the conversation grows past ~60k tokens it is compacted automatically, so
  the agent does not re-send an enormous prompt every turn.

## Requirements

- Windows, macOS or Linux
- [OpenCode](https://opencode.ai) installed (Desktop app or the `opencode` CLI)
- Node.js 20+

The app finds the CLI automatically, including the copy bundled with OpenCode
Desktop (`%APPDATA%\ai.opencode.desktop\cli\<version>\opencode-cli.exe`). Set
`OPENCODE_CLI` to override.

## Run

```sh
npm install
npm run dev
```

### If Electron's binary won't download

The runtime comes from GitHub releases, which is slow or blocked on some
networks. Use a mirror:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node node_modules\electron\install.js
```

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## Model & settings

`electron/main.js` pins new sessions to `opencode/deepseek-v4.1-flash-free` and
falls back to the user's configured default if that model is missing. Settings
talk to the host through `window.conv`:

- **Model** — grouped and searchable: free, OpenCode Go, and pay-per-token, with
  context size or price
- **Reasoning** — the model's effort variants (`auto` / `low` / `high` / …)
- **Theme** — dark or light
- **Chat** — token counter on/off (off by default), token budget

Switching a model calls OpenCode's `session.switchModel`, so the conversation
history survives. Settings are stored in `sandbox/.conv.json` together with the
session id.

## Build an installer

```sh
npm run setup      # out/setup/subzer0 Setup.exe
npm run release    # ...plus a distributable zip
npm run publish:release   # upload the zip as a GitHub release
```

The setup is a small Electron app, not an NSIS script: it copies its own runtime
into `%LOCALAPPDATA%\Programs\subzer0`, drops the app payload into
`resources/app`, creates desktop + Start menu shortcuts, and offers to launch it.
The wizard shows the install location, per-file progress (name, bytes, speed) and
a step checklist. It needs no network and no toolchain.

The icon is generated from code (`npm run icon`) into `assets/subzer0.png` and a
multi-size `.ico`, then stamped onto the setup executable with `resedit`, along
with product and version information. Standalone builds carry a stub
`window.conv`, so they still render — they just have no AI attached.

## Verify the AI bridge without the UI

```sh
npm run smoke
```

Creates a throwaway session, asks the agent to write one file, and fails if the
file does not appear. Prints the model and token usage it observed.

## Status

| Piece | State |
| --- | --- |
| Chat drives a local OpenCode session | working |
| AI edits the app you are looking at | working |
| Live reload after edits | working |
| Your messages + assistant messages rendered | working |
| Settings: model (free / Go / metered) + reasoning, 56 models | working |
| Dark + light themes, persisted | working |
| Token counter (off by default) + budget | working |
| Auto-compaction when the context grows | working |
| Starts its own OpenCode service when closed | working |
| Reset control | working |
| Recovery chat if an edit breaks the bridge | working |
| Export to `.exe` | `window.conv.exportApp()`, no button |
| Setup wizard + icon + distributable zip | working |

## Roadmap

1. **Undo** — per-message revert using OpenCode's revert/snapshot support.
2. **Streaming by delta** — render `session.text.delta` instead of refetching.
3. **Single-file installer** — wrap the setup folder with NSIS when CI is set up.

## License

MIT — see [LICENSE](LICENSE).
