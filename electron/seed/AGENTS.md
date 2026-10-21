# subzer0 — the app you are editing

These three files **are** the app the user is looking at. Edits appear instantly.

- `index.html` — structure
- `styles.css` — styling (two themes: `[data-theme='dark']`, `[data-theme='light']`)
- `app.js` — behavior

## Shape to keep

- one centered column (~680px): a small `subzer0` wordmark top-left, settings button top-right
- message log, user messages right-aligned in a bordered bubble, assistant replies plain
- composer at the bottom; the token meter below it is **off by default**
- settings dialog offers: model (free models only), reasoning effort, theme (dark/light),
  token counter toggle, token budget
- render only assistant `text` parts — no reasoning traces or tool logs
- no headers beyond the topbar, no logo screens, no emoji

## Hard rules

1. **Never break the chat.** Keep `window.conv.send(text)` on submit and keep rendering
   from `window.conv.onUpdate(...)`. That is the user's only way to reach you.
2. **Never break settings.** Keep the settings dialog working for model, reasoning,
   theme and the token counter.
3. Plain HTML/CSS/JS only. No frameworks, bundlers, npm, CDN or network imports.
4. Self-contained: no external images, fonts or scripts.
5. Preserve what the user liked; make surgical edits instead of rewriting whole files.
6. No dead UI. `window.conv.reset()` and `window.conv.exportApp()` exist but have no button.
7. No shell, no network. Read/write/edit/glob/grep inside this folder only.

## Bridge

```js
window.conv.send(text)              // send a message
window.conv.stop()                  // interrupt
window.conv.reset()                 // wipe back to the starting app
window.conv.settings.get()          // { model, theme, showTokens, budget }
window.conv.settings.set(patch)     // persist partial settings
window.conv.models.list()           // free models + reasoning variants
window.conv.models.select(model)    // switch model/variant, keeps history
window.conv.onUpdate(cb)            // chat state
window.conv.onSettings(cb)          // settings changed
window.conv.onError(cb)             // { message }
window.conv.onSandboxChange(cb)     // files changed on disk
```

`onUpdate` payload:

```js
{
  messages: [
    { id, type: 'user', text },
    { id, type: 'assistant', content: [{ type: 'text', text }, …] }
  ],
  tokens: { input, output, reasoning, cache: { read, write } },
  cost: 0.0012,
  budget: 200000,
  settings: { model: { providerID, id, variant }, theme, showTokens, budget },
  busy: false
}
```

`models.list()` → `{ providerID, id, name, context, variants: ['low','high','max'] }`.
Tokens used = `input + output + reasoning`; left = `budget - used`.
History is replayed on every reload — read it from `onUpdate`, never keep chat state.

## Design

Quiet and intentional. Black/white surfaces, one accent, hairline borders, 8–14px radii,
system font, generous spacing. No gradients, no glow, no emoji. Remove rather than add.

## Reply

One short sentence after the change. No code blocks, no file paths, no preamble.
