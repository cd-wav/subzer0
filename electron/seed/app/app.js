// subzer0 — the app. Everything here is yours to rewrite.
//
// The only fixed contract is `window.conv` (see electron/preload.js):
//   send(text), stop(), newChat(), reset(), exportApp(),
//   settings.get(), settings.set(patch),
//   models.list(), models.select(model),
//   sessions.list(), sessions.open(id),
//   updates.check(), updates.apply(),
//   onUpdate(cb), onError(cb), onSettings(cb), onSessions(cb),
//   onUpdateProgress(cb), onSandboxChange(cb)
//
// onUpdate payload:
//   { messages, tokens, cost, budget, settings, providers, busy }

const el = {
  log: document.getElementById('log'),
  composer: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  meter: document.getElementById('meter'),
  meterFill: document.getElementById('meterFill'),
  meterLeft: document.getElementById('meterLeft'),
  meterCost: document.getElementById('meterCost'),
  meterLocked: document.getElementById('meterLocked'),
  tokensLabel: document.getElementById('tokensLabel'),
  stopBtn: document.getElementById('stopBtn'),
  sessionTitle: document.getElementById('sessionTitle'),
  newChat: document.getElementById('newChat'),
  sessions: document.getElementById('sessions'),
  clearAll: document.getElementById('clearAll'),
  modelChip: document.getElementById('modelChip'),
  modelChipName: document.getElementById('modelChipName'),
  modelChipPlan: document.getElementById('modelChipPlan'),
  modelDot: document.getElementById('modelDot'),
  gear: document.getElementById('gear'),
  sheet: document.getElementById('settings'),
  close: document.getElementById('close'),
  models: document.getElementById('models'),
  modelSearch: document.getElementById('modelSearch'),
  modelNote: document.getElementById('modelNote'),
  variants: document.getElementById('variants'),
  reasoningNote: document.getElementById('reasoningNote'),
  themes: document.getElementById('themes'),
  accents: document.getElementById('accents'),
  densities: document.getElementById('densities'),
  fontSizes: document.getElementById('fontSizes'),
  showTokens: document.getElementById('showTokens'),
  budget: document.getElementById('budget'),
}

const THEMES = [
  { id: 'dark', name: 'Dark', bg: '#0a0a0c', line: '#1e1e24', accent: '#6d77ff' },
  { id: 'light', name: 'Light', bg: '#fbfbfc', line: '#e4e4ea', accent: '#4b55e6' },
]

const ACCENTS = [
  { id: 'indigo', color: '#6d77ff', light: '#4b55e6' },
  { id: 'emerald', color: '#2fbf8f', light: '#128a63' },
  { id: 'amber', color: '#dba63c', light: '#a7741c' },
  { id: 'rose', color: '#e05a72', light: '#c23a55' },
  { id: 'violet', color: '#a06bff', light: '#7c46d8' },
  { id: 'slate', color: '#8f96a3', light: '#5d646f' },
]

const DENSITIES = [
  { id: 'comfortable', name: 'Cozy' },
  { id: 'compact', name: 'Compact' },
]

const FONT_SIZES = [
  { id: 'small', name: 'S' },
  { id: 'medium', name: 'M' },
  { id: 'large', name: 'L' },
]

const HINTS = [
  'Give this a sidebar with folders',
  'Make it feel like a terminal',
  'Add a notes panel on the right',
]

const DEFAULT_SETTINGS = {
  model: { providerID: 'opencode', id: 'deepseek-v4.1-flash-free', variant: 'default' },
  theme: 'dark',
  accent: 'indigo',
  density: 'comfortable',
  fontSize: 'medium',
  showTokens: true,
  budget: 200000,
}

let settings = structuredClone(DEFAULT_SETTINGS)
let models = []
let modelsLoaded = false
let modelQuery = ''
/** 'unknown' until a Go model has actually run: there is no plan endpoint. */
let goStatus = 'unknown'
let sessions = []
let sessionID = null
let messages = []
let lastTokens = null
let lastCost = 0
let busy = false
let pending = null
/** @type {{ message: string, kind?: string } | null} */
let error = null
/** Message count when the error appeared, so a later reply clears it. */
let errorAt = 0
/** Latest release from window.conv.updates; drives the Update message. */
let release = null
let updateBusy = false
let updateNote = ''

/* ------------------------------------------------------------------ settings */

function activeAccent() {
  const accent = ACCENTS.find((entry) => entry.id === settings.accent) ?? ACCENTS[0]
  return settings.theme === 'light' ? accent.light : accent.color
}

function applySettings() {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.dataset.density = settings.density
  root.dataset.size = settings.fontSize
  root.style.setProperty('--accent', activeAccent())

  el.meter.hidden = !settings.showTokens
  el.showTokens.checked = Boolean(settings.showTokens)
  el.budget.value = String(settings.budget)

  const model = selectedModel()
  el.modelChipName.textContent = model?.name ?? settings.model.id
  el.modelChipPlan.textContent = model
    ? model.plan === 'go'
      ? 'Go'
      : model.plan === 'paid'
        ? 'Paid'
        : 'Free'
    : ''
  el.modelDot.dataset.plan = model?.plan ?? 'free'

  renderModels()
  renderVariants()
  renderThemes()
  renderAccents()
  renderSegments(el.densities, DENSITIES, settings.density, (id) => save({ density: id }))
  renderSegments(el.fontSizes, FONT_SIZES, settings.fontSize, (id) => save({ fontSize: id }))
  renderSessions()
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
    error = { message: String(cause?.message ?? cause) }
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

/* ------------------------------------------------------------------ sessions */

// "Clear all" clears only subzer0's rail: session ids are hidden locally and
// the OpenCode sessions themselves are never deleted. localStorage can be
// unavailable in embedded contexts, so fall back to memory.
const HIDDEN_KEY = 'subzer0.hidden-sessions'

function loadHiddenSessions() {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY)
    const list = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

let hiddenSessions = loadHiddenSessions()

function persistHiddenSessions() {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenSessions]))
  } catch {
    /* memory-only is fine */
  }
}

function visibleSessions() {
  return sessions.filter((session) => !hiddenSessions.has(session.id))
}

function timeAgo(stamp) {
  if (!stamp) return ''
  const seconds = Math.max(0, Math.round((Date.now() - stamp) / 1000))
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

function renderSessions() {
  const visible = visibleSessions()
  el.clearAll.hidden = !visible.length

  if (!visible.length) {
    el.sessions.innerHTML = '<p class="rail-empty">No conversations yet</p>'
    return
  }

  const frag = document.createDocumentFragment()
  for (const session of visible) {
    const row = document.createElement('div')
    row.className = 'session-row'
    if (session.id === sessionID) row.setAttribute('aria-current', 'true')

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'session'

    const name = document.createElement('span')
    name.className = 'session-name'
    name.textContent = session.title || 'New chat'

    const meta = document.createElement('span')
    meta.className = 'session-meta'
    meta.textContent = timeAgo(session.updated)

    button.append(name, meta)
    button.addEventListener('click', () => {
      void window.conv.sessions.open(session.id)
    })

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'session-del'
    del.title = 'Delete conversation'
    del.setAttribute('aria-label', `Delete ${session.title || 'conversation'}`)
    del.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="m2.5 2.5 5 5m0-5-5 5"/></svg>'
    del.addEventListener('click', (event) => {
      event.stopPropagation()
      void window.conv.sessions.remove(session.id)
    })

    row.append(button, del)
    frag.appendChild(row)
  }

  el.sessions.replaceChildren(frag)
}

function refreshSessions() {
  window.conv.sessions
    .list()
    .then((list) => {
      sessions = list ?? []
      renderSessions()
    })
    .catch(() => {})
}

/* -------------------------------------------------------------------- models */

const GROUPS = [
  { plan: 'free', label: 'Free', hint: 'no subscription needed' },
  { plan: 'go', label: 'OpenCode Go', hint: '' },
  { plan: 'paid', label: 'Pay per token', hint: 'billed to your OpenCode balance' },
]

function goHint() {
  if (goStatus === 'inactive') return 'not active on this account'
  if (goStatus === 'active') return 'active on this account'
  return 'included in your subscription'
}

function modelMeta(model) {
  if (model.plan === 'paid') {
    const { input, output } = model.price ?? {}
    return input || output ? `$${input} / $${output} per M` : 'metered'
  }
  return model.context ? `${Math.round(model.context / 1000)}K` : ''
}

function modelRow(model) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'model'
  const active = model.id === settings.model.id && model.providerID === settings.model.providerID
  button.setAttribute('aria-pressed', String(active))

  const dot = document.createElement('span')
  dot.className = 'dot'

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = model.name

  const meta = document.createElement('span')
  meta.className = 'meta'
  meta.textContent = modelMeta(model)

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
  return button
}

function renderModels() {
  if (!models.length) {
    el.models.innerHTML = `<p class="empty">${
      modelsLoaded ? 'No models available.' : 'Loading…'
    }</p>`
    el.modelNote.textContent = ''
    return
  }

  const query = modelQuery.trim().toLowerCase()
  const visible = models.filter(
    (model) =>
      !query ||
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query)
  )

  const frag = document.createDocumentFragment()

  for (const group of GROUPS) {
    const items = visible.filter((model) => model.plan === group.plan)
    if (!items.length) continue

    const head = document.createElement('div')
    head.className = 'model-group'
    head.dataset.plan = group.plan

    const label = document.createElement('span')
    label.textContent = group.label

    const hint = document.createElement('span')
    hint.className = 'model-group-hint'
    hint.textContent = group.plan === 'go' ? goHint() : group.hint

    head.append(label, hint)
    frag.appendChild(head)

    for (const model of items) frag.appendChild(modelRow(model))
  }

  if (!frag.childNodes.length) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = `No model matches “${modelQuery.trim()}”.`
    frag.appendChild(empty)
  }

  el.models.replaceChildren(frag)
  el.modelNote.textContent = `${visible.length} of ${models.length}`
}

/* ------------------------------------------------------------------ variants */

function renderVariants() {
  const model = selectedModel()
  const variants = model?.variants ?? []
  const options = ['default', ...variants]

  el.reasoningNote.textContent = variants.length
    ? `${variants.join(' / ')}`
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

function renderAccents() {
  const frag = document.createDocumentFragment()
  for (const accent of ACCENTS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'swatch'
    button.style.setProperty('--swatch', settings.theme === 'light' ? accent.light : accent.color)
    button.setAttribute('aria-pressed', String(settings.accent === accent.id))
    button.title = accent.id
    button.setAttribute('aria-label', accent.id)
    button.addEventListener('click', () => {
      void save({ accent: accent.id })
    })
    frag.appendChild(button)
  }
  el.accents.replaceChildren(frag)
}

function renderSegments(container, options, current, onPick) {
  const frag = document.createDocumentFragment()
  for (const option of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(current === option.id))
    button.textContent = option.name
    button.addEventListener('click', () => onPick(option.id))
    frag.appendChild(button)
  }
  container.replaceChildren(frag)
}

/* ------------------------------------------------------------------ updates */

/** Ask the host whether a newer subzer0 release is out. Quiet when it can't. */
async function checkForUpdate() {
  if (!window.conv.updates) return
  try {
    const result = await window.conv.updates.check()
    if (result && result.ok) {
      release = result
      updateNote = ''
    }
  } catch {
    /* offline, no gh, or an older host build: nothing to show */
  }
  renderMessages()
}

/** Download + reinstall the newest release; the app then relaunches itself. */
async function applyUpdate() {
  if (updateBusy || !window.conv.updates) return
  updateBusy = true
  updateNote = 'Downloading…'
  renderMessages()

  try {
    const result = await window.conv.updates.apply()
    if (result && result.ok === false) {
      updateBusy = false
      updateNote = result.reason || 'Update failed'
      renderMessages()
    }
  } catch (cause) {
    updateBusy = false
    updateNote = String(cause?.message ?? cause)
    renderMessages()
  }
  // On success the host quits and relaunches; nothing left to render.
}

function updateCard() {
  const line = document.createElement('div')
  line.className = 'update'

  const text = document.createElement('span')
  text.textContent = updateBusy
    ? updateNote || 'Updating…'
    : updateNote || `subzer0 ${release?.latest} is available — you're on ${release?.current}`
  line.appendChild(text)

  const action = document.createElement('button')
  action.type = 'button'
  action.className = 'update-btn'
  action.textContent = updateBusy ? 'Updating…' : 'Update'
  action.disabled = updateBusy
  action.addEventListener('click', () => void applyUpdate())
  line.appendChild(action)

  return line
}

/* ------------------------------------------------------------------- messages */

function intro() {
  const wrap = document.createElement('div')
  wrap.className = 'intro'

  const title = document.createElement('h1')
  title.textContent = 'What should this app become?'

  const line = document.createElement('p')
  line.textContent =
    'Ask in plain language. The AI edits this window while you watch — layout, color, panels, whole new features.'

  const hints = document.createElement('div')
  hints.className = 'intro-hints'
  for (const hint of HINTS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'hint'
    chip.textContent = hint
    chip.addEventListener('click', () => {
      el.input.value = hint
      el.input.focus()
      autosize()
    })
    hints.appendChild(chip)
  }

  wrap.append(title, line, hints)
  return wrap
}

function renderMessages() {
  const stick = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 90
  el.log.replaceChildren()

  const showUpdate = Boolean(release?.available || updateBusy)

  if (!messages.length && !busy && !pending && !error) {
    el.log.appendChild(intro())
    if (showUpdate) el.log.appendChild(updateCard())
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

    const text = document.createElement('span')
    text.textContent = error.message ?? String(error)
    line.appendChild(text)

    if (error.kind === 'limit' || error.kind === 'plan') {
      const action = document.createElement('button')
      action.type = 'button'
      action.className = 'err-action'
      action.textContent = 'Choose a model'
      action.addEventListener('click', () => void openSheet())
      line.appendChild(action)
    }

    el.log.appendChild(line)
  }

  if (showUpdate) el.log.appendChild(updateCard())

  if (stick) el.log.scrollTop = el.log.scrollHeight
}

function renderTokens(tokens, cost) {
  if (tokens) lastTokens = tokens
  if (typeof cost === 'number') lastCost = cost
  if (!settings.showTokens || !lastTokens) {
    el.tokensLabel.textContent = ''
    return
  }

  const used =
    (lastTokens.input ?? 0) + (lastTokens.output ?? 0) + (lastTokens.reasoning ?? 0)
  const left = Math.max(0, settings.budget - used)
  const pct = Math.min(100, (used / settings.budget) * 100)

  el.tokensLabel.textContent = `${used.toLocaleString('en-US')} used · ${left.toLocaleString('en-US')} left`
  el.meterLeft.textContent = `${pct.toFixed(1)}% of ${settings.budget.toLocaleString('en-US')}`
  el.meterFill.style.width = pct + '%'
  el.meterFill.className = 'meter-fill' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '')
  el.meterCost.textContent = lastCost > 0 ? `$${lastCost.toFixed(4)}` : ''
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

/* --------------------------------------------------------------------- submit */

async function submit() {
  const text = el.input.value.trim()
  if (!text || busy) return

  error = null
  errorAt = 0
  pending = text
  el.input.value = ''
  autosize()
  busy = true
  el.send.disabled = true
  el.stopBtn.hidden = false
  renderMessages()

  try {
    const result = await window.conv.send(text)
    // Standalone exports have no AI behind the bridge; don't hang on "working".
    if (result && result.ok === false) {
      error = {
        message: result.reason
          ? `This copy has no AI attached (${result.reason}).`
          : 'This copy has no AI attached.',
      }
      busy = false
      pending = null
      el.send.disabled = false
      el.stopBtn.hidden = true
      renderMessages()
    }
  } catch (cause) {
    error = { message: String(cause?.message ?? cause) }
    busy = false
    pending = null
    el.send.disabled = false
    el.stopBtn.hidden = true
    renderMessages()
  }
}

function autosize() {
  el.input.style.height = 'auto'
  el.input.style.height = Math.min(220, el.input.scrollHeight) + 'px'
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
el.modelChip.addEventListener('click', () => void openSheet())
el.close.addEventListener('click', closeSheet)

el.sheet.addEventListener('click', (event) => {
  if (event.target === el.sheet) closeSheet()
})

el.newChat.addEventListener('click', () => {
  void window.conv.newChat()
})

el.stopBtn.addEventListener('click', () => {
  void window.conv.stop()
})

el.showTokens.addEventListener('change', () => {
  void save({ showTokens: el.showTokens.checked })
})

el.budget.addEventListener('change', () => {
  const value = Number(el.budget.value)
  if (Number.isFinite(value) && value > 0) void save({ budget: value })
})

el.modelSearch.addEventListener('input', () => {
  modelQuery = el.modelSearch.value
  renderModels()
})

// "Clear all" asks once (first click arms it for 4s). It only clears the rail
// in this app — the OpenCode sessions are left untouched.
let clearArmedAt = 0
let clearArmTimer = null

function disarmClear() {
  clearArmedAt = 0
  el.clearAll.classList.remove('arm')
  el.clearAll.textContent = 'Clear all'
}

el.clearAll.addEventListener('click', () => {
  if (Date.now() - clearArmedAt < 4000) {
    disarmClear()
    for (const session of visibleSessions()) hiddenSessions.add(session.id)
    persistHiddenSessions()
    renderSessions()
    return
  }
  clearArmedAt = Date.now()
  el.clearAll.classList.add('arm')
  el.clearAll.textContent = 'Sure? Tap again'
  if (clearArmTimer) clearTimeout(clearArmTimer)
  clearArmTimer = setTimeout(disarmClear, 4000)
})

document.addEventListener('keydown', (event) => {
  const mod = event.ctrlKey || event.metaKey
  if (!mod) return
  if (event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void openSheet()
  }
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault()
    void window.conv.newChat()
  }
})

window.conv.onUpdate((update) => {
  messages = update.messages ?? []
  busy = Boolean(update.busy)
  pending = null
  if (update.settings) settings = update.settings
  if (update.providers?.go) goStatus = update.providers.go
  if (update.sessionID) sessionID = update.sessionID

  if (error && messages.length > errorAt) {
    error = null
    errorAt = 0
  }

  el.send.disabled = busy
  el.stopBtn.hidden = !busy
  applySettings()
  renderMessages()
  renderTokens(update.tokens, update.cost)
})

window.conv.onSettings((next) => {
  settings = next
  applySettings()
})

window.conv.onSessions((payload) => {
  sessions = payload?.sessions ?? []
  if (payload?.current) sessionID = payload.current
  renderSessions()

  const current = sessions.find((session) => session.id === sessionID)
  el.sessionTitle.textContent = current?.title || 'New chat'
})

window.conv.onError((payload) => {
  error = { message: payload?.message ?? String(payload), kind: payload?.kind }
  errorAt = messages.length
  renderMessages()
})

window.conv.onUpdateProgress?.((payload) => {
  if (payload?.message) {
    updateNote = payload.message
    renderMessages()
  }
})

// Re-check for new releases once in a while without waiting for a reload.
setInterval(() => void checkForUpdate(), 6 * 60 * 60 * 1000)

window.conv.init().then(async (result) => {
  if (result?.settings) {
    settings = result.settings
  }
  if (result?.sessionID) sessionID = result.sessionID
  if (Array.isArray(result?.sessions)) sessions = result.sessions

  applySettings()
  refreshSessions()
  void checkForUpdate()

  const current = sessions.find((session) => session.id === sessionID)
  el.sessionTitle.textContent = current?.title || 'New chat'

  // Fetch the model list once so the settings sheet is instant.
  try {
    models = (await window.conv.models.list()) ?? []
    modelsLoaded = true
    applySettings()
  } catch {
    /* the sheet will retry */
  }
})
