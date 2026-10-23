# subzer0 — the app you are editing

These three files **are** the app the user is looking at. Edits appear instantly.

- `index.html` — structure
- `styles.css` — styling (two themes: `[data-theme='dark']`, `[data-theme='light']`)
- `app.js` — behavior

## Shape to keep

- Desktop web-app layout: a left rail (brand + logo, New chat, conversation list,
  model chip, Settings) beside a wide main column.
- Top bar with the conversation title and a token readout; Stop appears while busy.
- Sidebar conversations can be deleted (× on hover), pinned (a pin icon on hover,
  pinned sort to the top) and searched; "Clear all" empties the rail locally and
  never deletes the OpenCode sessions (first click arms it, second click confirms).
- Message log is wide (max 880px) and centered; user messages right-aligned in a
  bordered bubble, assistant replies rendered as light markdown (headings, bold,
  italic, inline code, lists, quotes, links and fenced code blocks).
- A ` ```poll ` fence in a reply renders as an interactive poll: the first line
  is the question, then one `- option` line per choice. Votes persist locally
  (`subzer0.poll-votes`).
- Composer pinned at the bottom, token meter underneath — **on by default**.
- A command palette (⌘P) fuzzy-searches every action: new chat, settings, theme,
  density, notes, token counter, edit, clear.
- When a newer subzer0 release is out, the app updates itself automatically in
  the background (download + reinstall + relaunch, no click needed); the update
  button in the top bar shows progress while it installs.
- Settings dialog: model (free / OpenCode Go / pay-per-token, grouped and
  searchable), language, reasoning effort, theme (dark/light/system), accent
  colour, density, text size, token counter toggle, token budget.
- User messages show an "edit" affordance (loads the text back into the
  composer); the last assistant reply shows "regenerate" (re-sends the prompt).
- Brand mark is the inline SVG slashed zero; never replace it with an emoji or a
  plain coloured square.
- Render only assistant `text` parts — no reasoning traces or tool logs.

## Hard rules

1. **Never break the chat.** Keep `window.conv.send(text)` on submit and keep rendering
   from `window.conv.onUpdate(...)`. That is the user's only way to reach you.
2. **Never break settings.** Keep model, reasoning, theme, accent, density, text
   size and the token counter working.
3. **Translate every string.** The language selector swaps the whole UI (12
   languages, persisted in `localStorage`). Never hardcode user-facing text:
   static markup uses `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`
   and `data-i18n-aria`; javascript uses `t('key', { vars })`. Add the key to
   `MESSAGES` for all 12 languages.
4. Plain HTML/CSS/JS only. No frameworks, bundlers, npm, CDN or network imports.
5. Self-contained: no external images, fonts or scripts. Inline SVG only.
6. Preserve what the user liked; make surgical edits instead of rewriting whole files.
7. No dead UI. `window.conv.reset()` and `window.conv.exportApp()` exist but have no button.
8. No shell, no network. Read/write/edit/glob/grep inside this folder only.

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
window.conv.sessions.remove(id)    // delete one conversation
window.conv.sessions.clear()        // delete every conversation here
window.conv.updates.check()         // { ok, current, latest, available, notes }
window.conv.updates.apply()         // download + reinstall the newest release
window.conv.onUpdate(cb)            // chat state
window.conv.onSettings(cb)          // settings changed
window.conv.onSessions(cb)          // { sessions, current }
window.conv.onError(cb)             // { message, kind }
window.conv.onUpdateProgress(cb)    // { message } while an update installs
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
