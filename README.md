# subzer0

an open-source ai app that rewrites itself.

you open it and get a dark, quiet chat window. tell the ai what you want — "add
a sidebar", "make it look like a terminal" — and it edits the app you are
looking at. the window reloads and the change is there. the whole ui is three
plain files, and the ai can rewrite any of them.

no api keys, no model downloads. it drives [opencode](https://opencode.ai), the
coding agent on your machine, and uses every model opencode can see — free,
opencode go, or metered. it also updates itself in the background.

## how this was made

ai was used to build this. a lot of it. but not everything — a human made the
calls, wrote the plumbing, picked the look, and edited the parts that mattered.
it is not pretending otherwise.

## run

```sh
npm install
npm run dev
```

needs node 20+ and opencode installed. if electron's binary won't download:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node node_modules\electron\install.js
```

## build

```sh
npm run setup              # out/setup/subzer0 Setup.exe
npm run publish:release    # build + publish a github release
```

## license

mit — see [license](LICENSE).
