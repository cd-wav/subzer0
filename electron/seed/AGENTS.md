# subzer0 — the app you are editing

These three files **are** the app the user is looking at. Edits appear instantly.

- `index.html` — structure
- `styles.css` — styling (two themes: `[data-theme='dark']`, `[data-theme='light']`)
- `app.js` — behavior

## Shape to keep

- Desktop web-app layout: a left rail (brand + logo, New chat, conversation list,
  model chip, Settings) beside a wide main column.
- Top bar with the conversation title and a token readout; Stop appears while busy.
- Message log is wide (max 880px) and centered; user messages right-aligned in a
  bordered bubble, assistant replies plain text.
- Composer pinned at the bottom, token meter underneath — **on by default**.
- Settings dialog: model (free / OpenCode Go / pay-per-token, grouped and
  searchable), reasoning effort, theme (dark/light), accent colour, density,
  text size, token counter toggle, token budget.
- Brand mark is the inline SVG slashed zero; never replace it with an emoji or a
  plain coloured square.
- Render only assistant `text` parts — no reasoning traces or tool logs.

## Hard rules

1. **Never break the chat.** Keep `window.conv.send(text)` on submit and keep rendering
   from `window.conv.onUpdate(...)`. That is the user's only way to reach you.
2. **Never break settings.** Keep model, reasoning, theme, accent, density, text
   size and the token counter working.
3. Plain HTML/CSS/JS only. No frameworks, bundlers, npm, CDN or network imports.
4. Self-contained: no external images, fonts or scripts. Inline SVG only.
5. Preserve what the user liked; make surgical edits instead of rewriting whole files.
6. No dead UI. `window.conv.reset()` and `window.conv.exportApp()` exist but have no button.
7. No shell, no network. Read/write/edit/glob/grep inside this folder only.

## Bridge

```js
window.conv.send(text)              // send a message
window.conv.stop()                  // interrupt the current turn
window.conv.newChat()               // start a fresh conversation
window.conv.reset()                 // wipe back to the starting app
window.conv.settings.get()          // { model, theme, accent, density, fontSize, showTokens, budget }
window.conv.settings.set(patch)     // persist partial settings
window.conv.models.list()           // every model + reasoning variants
window.conv.models.select(model)    // switch model/variant, keeps history
window.conv.sessions.list()         // recent conversations
window.conv.sessions.open(id)       // switch conversation
window.conv.onUpdate(cb)            // chat state
window.conv.onSettings(cb)          // settings changed
window.conv.onSessions(cb)          // { sessions, current }
window.conv.onError(cb)             // { message, kind }
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
  settings: { model: { providerID, id, variant }, theme, accent, density, fontSize, showTokens, budget },
  providers: { go: 'unknown' | 'active' | 'inactive' },
  sessionID,
  busy: false
}
```

`models.list()` → `{ providerID, id, name, plan, price, context, variants }` where
`plan` is `'free'`, `'go'` (OpenCode Go subscription) or `'paid'` (metered).
Errors arrive as `{ message, kind }` with `kind` = `'limit'` when the free or Go
usage limit was hit, `'plan'` when Go is not on the account, `'auth'` when OpenCode
needs a sign-in. Show the message; offer Settings when it is `limit` or `plan`.

`accent` is one of `indigo`, `emerald`, `amber`, `rose`, `violet`, `slate`.
`density` is `comfortable` or `compact`; `fontSize` is `small`, `medium`, `large`.
Tokens used = `input + output + reasoning`; left = `budget - used`.
History is replayed on every reload — read it from `onUpdate`, never keep chat state.

## Design

Quiet and intentional. Black/white surfaces, one accent, hairline borders, 8–14px
radii, system font, generous spacing, wide desktop proportions. No gradients, no
glow, no emoji. Remove rather than add.

## Reply

One short sentence after the change. No code blocks, no file paths, no preamble.
