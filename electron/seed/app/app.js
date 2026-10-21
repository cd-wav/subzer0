// subzer0 — the app. Everything here is yours to rewrite.
//
// The only fixed contract is `window.conv` (see electron/preload.js):
//   send(text), stop(), reset(), exportApp(),
//   settings.get(), settings.set(patch),
//   models.list(), models.select(model),
//   onUpdate(cb), onError(cb), onSettings(cb), onSandboxChange(cb)
//
// onUpdate payload: { messages, tokens, cost, budget, settings, busy }

const el = {
  log: document.getElementById('log'),
  composer: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  meter: document.getElementById('meter'),
  meterFill: document.getElementById('meterFill'),
  meterLeft: document.getElementById('meterLeft'),
  meterCost: document.getElementById('meterCost'),
  gear: document.getElementById('gear'),
  sheet: document.getElementById('settings'),
  close: document.getElementById('close'),
  models: document.getElementById('models'),
  modelNote: document.getElementById('modelNote'),
  variants: document.getElementById('variants'),
  reasoningNote: document.getElementById('reasoningNote'),
  themes: document.getElementById('themes'),
  showTokens: document.getElementById('showTokens'),
  budget: document.getElementById('budget'),
}

const THEMES = [
  { id: 'dark', name: 'Dark', bg: '#09090b', line: '#1d1d21', accent: '#6d77ff' },
  { id: 'light', name: 'Light', bg: '#fbfbfc', line: '#e5e5ea', accent: '#4b55e6' },
]

const DEFAULT_SETTINGS = {
  model: { providerID: 'opencode', id: 'deepseek-v4.1-flash-free', variant: 'default' },
  theme: 'dark',
  showTokens: false,
  budget: 200000,
}

let settings = structuredClone(DEFAULT_SETTINGS)
let models = []
let modelsLoaded = false
let messages = []
let busy = false
let pending = null
let error = null

/* ------------------------------------------------------------------ settings */

function applySettings() {
  document.documentElement.dataset.theme = settings.theme
  el.meter.hidden = !settings.showTokens
  el.showTokens.checked = Boolean(settings.showTokens)
  el.budget.value = String(settings.budget)
  renderModels()
  renderVariants()
  renderThemes()
}

async function save(patch) {
  settings = {
    ...settings,
    ...patch,
    model: { ...settings.model, ...(patch.model ?? {}) },
  }
  applySettings()

  try {
    const next = await window.conv.settings.set(patch)
    if (next) {
      settings = next
      applySettings()
    }
  } catch (cause) {
    error = String(cause?.message ?? cause)
    renderMessages()
  }
}

function selectedModel() {
  return (
    models.find(
      (model) => model.id === settings.model.id && model.providerID === settings.model.providerID
    ) ?? null
  )
}

/* -------------------------------------------------------------------- models */

function renderModels() {
  if (!models.length) {
    el.models.innerHTML = `<p class="empty">${
      modelsLoaded ? 'No free models available.' : 'Loading…'
    }</p>`
    return
  }

  const frag = document.createDocumentFragment()
  for (const model of models) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'model'
    const active =
      model.id === settings.model.id && model.providerID === settings.model.providerID
    button.setAttribute('aria-pressed', String(active))

    const dot = document.createElement('span')
    dot.className = 'dot'

    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = model.name

    const meta = document.createElement('span')
    meta.className = 'meta'
    meta.textContent = model.context ? `${Math.round(model.context / 1000)}K` : ''

    button.append(dot, name, meta)
    button.addEventListener('click', () => {
      const keep =
        settings.model.variant === 'default' || model.variants.includes(settings.model.variant)
      void save({
        model: {
          providerID: model.providerID,
          id: model.id,
          variant: keep ? settings.model.variant : 'default',
        },
      })
    })
    frag.appendChild(button)
  }

  el.models.replaceChildren(frag)
}

/* ------------------------------------------------------------------ variants */

function renderVariants() {
  const model = selectedModel()
  const variants = model?.variants ?? []
  const options = ['default', ...variants]

  el.reasoningNote.textContent = variants.length
    ? `this model supports ${variants.join(' / ')}`
    : 'not supported by this model'

  const frag = document.createDocumentFragment()
  for (const variant of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(settings.model.variant === variant))
    button.textContent = variant === 'default' ? 'auto' : variant
    button.disabled = !variants.length && variant !== 'default'
    button.addEventListener('click', () => {
      void save({ model: { variant } })
    })
    frag.appendChild(button)
  }

  el.variants.replaceChildren(frag)
}

/* -------------------------------------------------------------------- themes */

function renderThemes() {
  const frag = document.createDocumentFragment()

  for (const theme of THEMES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'theme'
    button.setAttribute('aria-pressed', String(settings.theme === theme.id))

    const preview = document.createElement('span')
    preview.className = 'preview'
    preview.style.background = theme.bg
    preview.style.borderColor = theme.line

    const lineA = document.createElement('i')
    lineA.style.background = theme.line
    const lineB = document.createElement('i')
    lineB.style.background = theme.accent
    preview.append(lineA, lineB)

    const label = document.createElement('span')
    label.className = 'theme-label'
    label.textContent = theme.name

    button.append(preview, label)
    button.addEventListener('click', () => {
      void save({ theme: theme.id })
    })
    frag.appendChild(button)
  }

  el.themes.replaceChildren(frag)
}

/* --------------------------------------------------------------------- sheet */

async function openSheet() {
  if (!el.sheet.open) el.sheet.showModal()
  applySettings()

  if (modelsLoaded) return

  el.models.innerHTML = '<p class="empty">Loading…</p>'
  try {
    models = (await window.conv.models.list()) ?? []
  } catch (cause) {
    models = []
    modelsLoaded = true
    el.models.innerHTML = `<p class="empty">Could not load models: ${String(
      cause?.message ?? cause
    )}</p>`
    return
  }
  modelsLoaded = true
  applySettings()
}

function closeSheet() {
  if (el.sheet.open) el.sheet.close()
}

/* ------------------------------------------------------------------- messages */

function intro() {
  const wrap = document.createElement('div')
  wrap.className = 'intro'
  const title = document.createElement('h1')
  title.textContent = 'subzer0'
  const line = document.createElement('p')
  line.textContent = 'Talk to the AI. It rewrites the window you are looking at.'
  wrap.append(title, line)
  return wrap
}

function renderMessages() {
  const stick = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 90
  el.log.replaceChildren()

  if (!messages.length && !busy && !pending && !error) {
    el.log.appendChild(intro())
    return
  }

  for (const message of messages) {
    if (message.type === 'user') {
      // OpenCode 2.1.2 puts the text at the top level: { id, type: 'user', text }.
      const text = message.text ?? message.payload?.text
      if (!text) continue
      const bubble = document.createElement('div')
      bubble.className = 'msg user'
      bubble.textContent = text
      el.log.appendChild(bubble)
      continue
    }

    if (message.type !== 'assistant') continue

    // Only what the AI actually says. Reasoning traces and tool calls are
    // noise in a chat this small.
    for (const part of message.content ?? []) {
      if (part.type !== 'text' || !part.text.trim()) continue
      const bubble = document.createElement('div')
      bubble.className = 'msg assistant'
      bubble.textContent = part.text
      el.log.appendChild(bubble)
    }
  }

  if (pending) {
    const bubble = document.createElement('div')
    bubble.className = 'msg user'
    bubble.textContent = pending
    el.log.appendChild(bubble)
  }

  if (busy) {
    const indicator = document.createElement('div')
    indicator.className = 'working'
    indicator.innerHTML = '<span></span><span></span><span></span>'
    el.log.appendChild(indicator)
  }

  if (error) {
    const line = document.createElement('div')
    line.className = 'error'
    line.textContent = error
    el.log.appendChild(line)
  }

  if (stick) el.log.scrollTop = el.log.scrollHeight
}

function renderMeter(tokens, cost) {
  if (!settings.showTokens) return
  const used = (tokens?.input ?? 0) + (tokens?.output ?? 0) + (tokens?.reasoning ?? 0)
  const left = Math.max(0, settings.budget - used)
  const pct = Math.min(100, (used / settings.budget) * 100)

  el.meterLeft.textContent = `${left.toLocaleString('en-US')} tokens left`
  el.meterFill.style.width = pct + '%'
  el.meterFill.className = 'meter-fill' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '')
  el.meterCost.textContent = typeof cost === 'number' && cost > 0 ? `$${cost.toFixed(4)}` : ''
}

/* --------------------------------------------------------------------- submit */

async function submit() {
  const text = el.input.value.trim()
  if (!text || busy) return

  error = null
  pending = text
  el.input.value = ''
  autosize()
  busy = true
  el.send.disabled = true
  renderMessages()

  try {
    const result = await window.conv.send(text)
    // Standalone exports have no AI behind the bridge; don't hang on "working".
    if (result && result.ok === false) {
      error = result.reason
        ? `This copy has no AI attached (${result.reason}).`
        : 'This copy has no AI attached.'
      busy = false
      pending = null
      el.send.disabled = false
      renderMessages()
    }
  } catch (cause) {
    error = String(cause?.message ?? cause)
    busy = false
    pending = null
    el.send.disabled = false
    renderMessages()
  }
}

function autosize() {
  el.input.style.height = 'auto'
  el.input.style.height = Math.min(180, el.input.scrollHeight) + 'px'
}

/* ----------------------------------------------------------------------- wire */

el.composer.addEventListener('submit', (event) => {
  event.preventDefault()
  void submit()
})

el.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
  }
})

el.input.addEventListener('input', autosize)

el.gear.addEventListener('click', () => void openSheet())
el.close.addEventListener('click', closeSheet)

el.sheet.addEventListener('click', (event) => {
  if (event.target === el.sheet) closeSheet()
})

el.showTokens.addEventListener('change', () => {
  void save({ showTokens: el.showTokens.checked })
})

el.budget.addEventListener('change', () => {
  const value = Number(el.budget.value)
  if (Number.isFinite(value) && value > 0) void save({ budget: value })
})

window.conv.onUpdate((update) => {
  messages = update.messages ?? []
  busy = Boolean(update.busy)
  pending = null
  if (update.settings) settings = update.settings

  el.send.disabled = busy
  applySettings()
  renderMessages()
  renderMeter(update.tokens, update.cost)
})

window.conv.onSettings((next) => {
  settings = next
  applySettings()
})

window.conv.onError(({ message }) => {
  error = message
  renderMessages()
})

window.conv.init().then(async (result) => {
  if (result?.settings) {
    settings = result.settings
    applySettings()
  }
  // Fetch the model list once so the settings sheet is instant.
  try {
    models = (await window.conv.models.list()) ?? []
    modelsLoaded = true
    applySettings()
  } catch {
    /* the sheet will retry */
  }
})
