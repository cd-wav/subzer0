'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/**
 * The bridge the generated app talks to.
 *
 * Everything the app can do lives here. The AI may rewrite the app's HTML, CSS
 * and JS freely, but it must keep calling these methods.
 *
 *   window.conv.send(text)            send a message to the AI
 *   window.conv.stop()                interrupt the AI
 *   window.conv.reset()               wipe the app back to the starting state
 *   window.conv.exportApp()           build a standalone .exe
 *   window.conv.settings.get()        { model, theme, showTokens, budget }
 *   window.conv.settings.set(patch)   persist a partial settings object
 *   window.conv.models.list()         every free model + its reasoning variants
 *   window.conv.models.select(model)  switch model/variant, keeping history
 *   window.conv.onUpdate(cb)          { messages, tokens, cost, budget, settings, busy }
 *   window.conv.onError(cb)           { message }
 *   window.conv.onSandboxChange(cb)   the app's files changed on disk
 *
 * Message shape:
 *   { id, type: 'user', text, time }
 *   { id, type: 'assistant', content: [
 *       { type: 'text', text },
 *       { type: 'reasoning', text },
 *       { type: 'tool', name, state: { status } }
 *   ] }
 */

/** Set once the app starts using the bridge. Until then we keep a safety net. */
let claimed = false
let lastState = null
let fallback = null

function markClaimed() {
  if (claimed) return
  claimed = true
  if (fallback) {
    fallback.host.remove()
    fallback = null
  }
}

contextBridge.exposeInMainWorld('conv', {
  init: () => {
    markClaimed()
    return ipcRenderer.invoke('app:init')
  },
  send: (text) => ipcRenderer.invoke('chat:send', text),
  stop: () => ipcRenderer.invoke('chat:stop'),
  reset: () => ipcRenderer.invoke('chat:reset'),
  exportApp: () => ipcRenderer.invoke('build:export'),
  setBudget: (value) => ipcRenderer.invoke('budget:set', value),

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  models: {
    list: () => ipcRenderer.invoke('models:list'),
    select: (model) => ipcRenderer.invoke('settings:set', { model }),
  },

  onSettings: (callback) => {
    markClaimed()
    ipcRenderer.on('app:settings', (_event, payload) => callback(payload))
  },
  onUpdate: (callback) => {
    markClaimed()
    ipcRenderer.on('app:update', (_event, payload) => callback(payload))
  },
  onError: (callback) => {
    ipcRenderer.on('app:error', (_event, payload) => callback(payload))
  },
  onSandboxChange: (callback) => {
    ipcRenderer.on('sandbox:changed', () => callback())
  },
  onBuildStatus: (callback) => {
    ipcRenderer.on('build:status', (_event, payload) => callback(payload))
  },
})

/* ------------------------------------------------------------------ state */

ipcRenderer.on('app:update', (_event, payload) => {
  lastState = payload
  if (fallback) fallback.render()
})

ipcRenderer.on('app:error', (_event, payload) => {
  if (fallback) {
    fallback.error.textContent = payload?.message ?? ''
  }
})

/* --------------------------------------------------------- host controls */

function whenReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true })
  } else {
    callback()
  }
}

function installHostControls() {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646'

  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `
    <style>
      :host { all: initial; }
      button {
        width: 30px; height: 30px; padding: 0;
        font: 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        cursor: pointer; border-radius: 50%;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(18,20,26,.8); color: #8b93a7;
        backdrop-filter: blur(6px);
      }
      button:hover { color: #fff; background: rgba(34,38,48,.95); }
    </style>
    <button id="reset" title="Reset the app">&#8635;</button>
  `

  root.getElementById('reset').addEventListener('click', async () => {
    if (confirm('Wipe the app and start over?')) await ipcRenderer.invoke('chat:reset')
  })

  document.documentElement.appendChild(host)
}

/* ------------------------------------------------------------ safety net */

/**
 * If the app never touches `window.conv` — for example the AI rewrote it into
 * something with no chat — inject a minimal chat panel so the user can still
 * reach the AI and ask for a fix. It removes itself the moment the app claims
 * the bridge.
 */
function installFallbackChat() {
  if (claimed || fallback) return

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:2147483645'

  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        width: 380px; max-height: 60vh; display: flex; flex-direction: column;
        font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
        background: rgba(12,14,19,.94); color: #dfe3ee;
        border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
        box-shadow: 0 18px 48px rgba(0,0,0,.6); overflow: hidden;
        backdrop-filter: blur(8px);
      }
      .head {
        display: flex; align-items: center; gap: 6px; padding: 8px 12px;
        border-bottom: 1px solid rgba(255,255,255,.1);
        font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
        color: #8b93a7;
      }
      .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
      .log {
        padding: 10px 12px; overflow-y: auto; display: flex;
        flex-direction: column; gap: 6px; min-height: 40px;
      }
      .you { color: #9fb4ff; }
      .ai { white-space: pre-wrap; }
      .ai::before { content: ""; }
      .err { color: #ff9b9b; font-size: 12px; padding: 0 12px 6px; }
      form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid rgba(255,255,255,.1); }
      input {
        flex: 1; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
        border-radius: 8px; color: inherit; font: inherit; padding: 7px 9px; outline: none;
      }
      input:focus { border-color: #4c5b86; }
      button {
        background: #e8eaf0; color: #0b0d12; border: 0; border-radius: 8px;
        font: inherit; font-weight: 600; padding: 0 12px; cursor: pointer;
      }
    </style>
    <div class="panel">
      <div class="head"><span class="dot"></span><span>AI · recovery chat</span></div>
      <div class="log"></div>
      <div class="err"></div>
      <form>
        <input placeholder="Ask the AI to fix this…" autocomplete="off" />
        <button type="submit">Send</button>
      </form>
    </div>
  `

  const log = root.querySelector('.log')
  const error = root.querySelector('.err')
  const form = root.querySelector('form')
  const input = root.querySelector('input')

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    void ipcRenderer.invoke('chat:send', text)
  })

  document.documentElement.appendChild(host)
  fallback = { host, log, error }

  function renderFallback() {
    const messages = lastState?.messages ?? []
    const lines = []
    for (const message of messages) {
      if (message.type === 'user') {
        const text = message.text ?? message.payload?.text
        if (text) lines.push({ kind: 'you', text })
      } else if (message.type === 'assistant') {
        const text = (message.content ?? [])
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
          .trim()
        if (text) lines.push({ kind: 'ai', text })
      }
    }

    log.replaceChildren(
      ...lines.slice(-8).map((line) => {
        const div = document.createElement('div')
        div.className = line.kind
        div.textContent = line.kind === 'you' ? '› ' + line.text : line.text
        return div
      })
    )
    log.scrollTop = log.scrollHeight
  }

  fallback.render = renderFallback
  renderFallback()
}

whenReady(() => {
  installHostControls()
  setTimeout(installFallbackChat, 1500)
})
