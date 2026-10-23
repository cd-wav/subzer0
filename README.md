# subzer0

an open-source ai app that rewrites itself.

you open it and get a quiet, dark, wide chat window with a sidebar. you tell the
ai what you want — "give me a sidebar", "make it look like a terminal" — and it
edits the app you are looking at, live. the window reloads and the change is
there. the whole interface is three plain files, and the ai can rewrite any of
them. no framework, no build step, no preview pane — the window is the app.

no api keys. no model downloads. it drives [opencode](https://opencode.ai), the
coding agent already on your machine, and sees every model opencode can see —
the free ones, opencode go, and metered models billed to your balance.

## how this was made

ai was used to build this. a lot of it. but not everything.

a human made the calls: decided what the thing should be, wrote the boring
plumbing, picked the look, and spent a long time arguing with the ai until it
stopped doing dumb things. the ai did the heavy lifting — the parts that would
have taken weeks to hand-write — and the human did the parts where taste and
judgment mattered. this is not a "look ma, no hands" project, and it is not
pretending to be one. the ai wrote most of the words and a human edited the ones
that mattered.

## how it works

```
+-- the window is the app ------------------------------+
|                                                       |
|   sandbox/app/{index.html,styles.css,app.js}          |
|   sidebar + wide chat, settings dialog                |
+---------------------------+---------------------------+
                            | window.conv  (preload bridge)
                            v
                    electron main process
                            | http + sse (localhost, basic auth)
                            v
                    opencode background service
                            | edits real files
                            v
            sandbox/app/*  ->  file change  ->  window reloads
```

- the window loads `preview://app/index.html`, served straight from `sandbox/app`
  by a custom protocol handler. the app you see *is* the generated app.
- `window.conv` (in `electron/preload.js`) is the only fixed contract: `send`,
  `stop`, `newChat`, `settings`, `models`, `sessions`, `updates`, `onUpdate`,
  `onError`.
- there is no `done` button and no reset button. the interface is fully
  customizable — the ai can rewrite every pixel of it.
- `sandbox/AGENTS.md` is the brief the agent gets every session. it is kept short
  on purpose — it is paid for on every message.
- every write triggers a debounced reload. message history is replayed from the
  server, so nothing is lost, and the session id persists across restarts.
- when the conversation grows past ~24k tokens it is compacted automatically, so
  the agent does not re-send an enormous prompt every turn.

## requirements

- windows, macos or linux
- [opencode](https://opencode.ai) installed (desktop app or the `opencode` cli)
- node.js 20+

the app finds the cli automatically, including the copy bundled with opencode
desktop (`%APPDATA%\ai.opencode.desktop\cli\<version>\opencode-cli.exe`). set
`OPENCODE_CLI` to override.

## run

```sh
npm install
npm run dev
```

### if electron's binary won't download

the runtime comes from github releases, which is slow or blocked on some
networks. use a mirror:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node node_modules\electron\install.js
```

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## what it can do

- the whole ui is lowercase, flat, monochrome, terminal-ish, and speaks 12
  languages from a settings dropdown.
- assistant replies render as markdown — headings, bold, inline code, lists,
  quotes, links and fenced code blocks — and a ` ```poll ` fence becomes an
  interactive poll you can vote on.
- a command palette (⌘p) fuzzy-searches every action.
- model, reasoning effort, theme (dark / light / system), accent, density, text
  size, token counter and token budget all live in settings and persist.
- switching a model calls opencode's `session.switchModel`, so the conversation
  history survives.
- the app updates itself in the background when a newer release lands — it
  downloads only the changed files, so an update is a couple of seconds.

## build an installer

```sh
npm run setup      # out/setup/subzer0 Setup.exe
npm run release    # ...plus a distributable zip
npm run publish:release   # upload the zip as a github release
```

the setup is a small electron app, not an nsis script: it copies its own runtime
into `%LOCALAPPDATA%\Programs\subzer0`, drops the app payload into
`resources/app`, and creates desktop + start menu shortcuts. it needs no network
and no toolchain.

the icon is generated from code (`npm run icon`) into `assets/subzer0.png` and a
multi-size `.ico`, then stamped onto the setup executable. standalone builds
carry a stub `window.conv`, so they still render — they just have no ai attached.

## verify the ai bridge without the ui

```sh
npm run smoke
```

creates a throwaway session, asks the agent to write one file, and fails if the
file does not appear. prints the model and token usage it observed.

## license

mit — see [license](LICENSE).
