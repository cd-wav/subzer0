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

const el = {
  log: document.getElementById('log'),
  composer: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  meter: document.getElementById('meter'),
  meterFill: document.getElementById('meterFill'),
  meterLeft: document.getElementById('meterLeft'),
  meterLocked: document.getElementById('meterLocked'),
  spend: document.getElementById('spend'),
  tokensLabel: document.getElementById('tokensLabel'),
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
  personalities: document.getElementById('personalities'),
  personalityNote: document.getElementById('personalityNote'),
  themes: document.getElementById('themes'),
  accents: document.getElementById('accents'),
  densities: document.getElementById('densities'),
  fontSizes: document.getElementById('fontSizes'),
  showTokens: document.getElementById('showTokens'),
  budget: document.getElementById('budget'),
  shell: document.querySelector('.shell'),
  notesToggle: document.getElementById('notesToggle'),
  noteForm: document.getElementById('noteForm'),
  noteInput: document.getElementById('noteInput'),
  notesList: document.getElementById('notesList'),
  notesCount: document.getElementById('notesCount'),
  cmdMenu: document.getElementById('cmdMenu'),
  custom: document.getElementById('custom'),
  updateBtn: document.getElementById('updateBtn'),
}

const THEMES = [
  { id: 'dark', name: 'dark', bg: '#000000', line: '#232323', accent: '#c9c9c9' },
  { id: 'light', name: 'light', bg: '#fafafa', line: '#e4e4e4', accent: '#1a1a1a' },
]

const ACCENTS = [
  { id: 'indigo', color: '#6d77ff', light: '#4b55e6' },
  { id: 'emerald', color: '#2fbf8f', light: '#128a63' },
  { id: 'amber', color: '#555555', light: '#2e2e2e' },
  { id: 'rose', color: '#e05a72', light: '#c23a55' },
  { id: 'violet', color: '#a06bff', light: '#7c46d8' },
  { id: 'slate', color: '#6b7280', light: '#3f4651' },
]

const DENSITIES = [
  { id: 'comfortable', name: 'cozy' },
  { id: 'compact', name: 'compact' },
]

const FONT_SIZES = [
  { id: 'small', name: 's' },
  { id: 'medium', name: 'm' },
  { id: 'large', name: 'l' },
]

const PERSONAS = [
  { id: 'casual', name: 'casual', note: 'relaxed and friendly', prompt: 'be casual, warm, and friendly. use plain, relaxed language with occasional light humor.' },
  { id: 'serious', name: 'serious', note: 'formal and precise', prompt: 'be serious, formal, and precise. no jokes, no slang, no emoji.' },
  { id: 'funny', name: 'funny', note: 'witty and playful', prompt: 'be witty and playful. crack jokes and keep the tone light and entertaining.' },
  { id: 'concise', name: 'concise', note: 'brief and direct', prompt: 'be brief and direct. short answers, no filler or preamble.' },
  { id: 'balanced', name: 'balanced', note: 'no persona', prompt: '' },
]

const PERSONALITY_KEY = 'subzer0.personality'
const ACCENT_KEY = 'subzer0.accent-violet'
const COMPACT_KEY = 'subzer0.compact'
const CUSTOM_KEY = 'subzer0.custom'
const CLEARED_KEY = 'subzer0.cleared'
const COMMANDS = ['persona', 'effort', 'model', 'version', 'compact', 'clear']

function storedPersonality() {
  try {
    return window.localStorage.getItem(PERSONALITY_KEY) ?? null
  } catch {
    return null
  }
}

function persistPersonality(id) {
  try {
    window.localStorage.setItem(PERSONALITY_KEY, id)
  } catch {
    /* memory-only is fine */
  }
}

function normalizePersonality() {
  if (!PERSONAS.some((p) => p.id === settings.personality)) {
    settings.personality = storedPersonality() || 'balanced'
  }
}

function withContext(text) {
  const persona = PERSONAS.find((p) => p.id === settings.personality)
  const parts = []
  if (persona && persona.prompt) parts.push(`[persona: ${persona.id}]\n${persona.prompt}`)
  if (customInstructions.trim()) parts.push(`[instructions]\n${customInstructions.trim()}`)
  if (!parts.length) return text
  return `${text}\n\n${parts.join('\n\n')}`
}

function cleanUserText(text) {
  if (!text) return text
  return text.replace(/\r?\n\r?\n\[(persona|instructions)[\s\S]*$/, '')
}

function loadCustom() {
  try {
    return window.localStorage.getItem(CUSTOM_KEY) ?? ''
  } catch {
    return ''
  }
}

function loadCleared() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CLEARED_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveCleared() {
  try {
    window.localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedMessages))
  } catch {
    /* memory-only is fine */
  }
}

/** Hide the transcript through the last cleared message, keeping the real history. */
function visibleMessages() {
  const marker = sessionID ? clearedMessages[sessionID] : null
  if (!marker) return messages
  const index = messages.findIndex((message) => message.id === marker)
  return index === -1 ? messages : messages.slice(index + 1)
}

function persistCustom() {
  try {
    window.localStorage.setItem(CUSTOM_KEY, customInstructions)
  } catch {
    /* memory-only is fine */
  }
}

function loadCompact() {
  try {
    return window.localStorage.getItem(COMPACT_KEY) === '1'
  } catch {
    return false
  }
}

function applyCompact() {
  document.documentElement.dataset.compact = compact ? 'on' : 'off'
}

const HINTS = [
  'give it a sidebar',
  'make it feel like a terminal',
  'add a notes panel',
]

const DEFAULT_SETTINGS = {
  model: { providerID: 'opencode', id: 'deepseek-v4.1-flash-free', variant: 'default' },
  theme: 'dark',
  accent: 'slate',
  density: 'comfortable',
  fontSize: 'medium',
  showTokens: true,
  budget: 200000,
  personality: 'balanced',
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
/**
 * Last message id hidden per session by ?clear. The conversation itself is kept
 * so the model still remembers it; only the transcript is trimmed.
 */
let clearedMessages = loadCleared()
let lastTokens = null
let lastCost = 0
let busy = false
let pending = null
/** @type {{ message: string, kind?: string } | null} */
let error = null
/** Message count when the error appeared, so a later reply clears it. */
let errorAt = 0
/** Transient command feedback rendered like a status line. */
let notice = null
/** denser chat spacing, toggled with ?compact. */
let compact = loadCompact()
applyCompact()
/** user-written custom instructions, appended to each message. */
let customInstructions = loadCustom()
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
  normalizePersonality()
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.dataset.density = settings.density
  root.dataset.size = settings.fontSize
  root.style.setProperty('--accent', activeAccent())

  el.meter.hidden = !settings.showTokens && !(lastCost > 0)
  el.meter.classList.toggle('spend-only', !settings.showTokens)
  el.showTokens.checked = Boolean(settings.showTokens)
  el.budget.value = String(settings.budget)
  el.custom.value = customInstructions

  const model = selectedModel()
  el.modelChipName.textContent = model?.name ?? settings.model.id
  el.modelChipPlan.textContent = model
    ? model.plan === 'go'
      ? 'go'
      : model.plan === 'paid'
        ? 'paid'
        : 'free'
    : ''
  el.modelDot.dataset.plan = model?.plan ?? 'free'

  renderModels()
  renderVariants()
  renderPersonality()
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
  if ('personality' in patch) persistPersonality(settings.personality)
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
    el.sessions.innerHTML = '<p class="rail-empty">no conversations yet</p>'
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
    name.textContent = session.title || 'new chat'

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
    del.title = 'delete conversation'
    del.setAttribute('aria-label', `delete ${session.title || 'conversation'}`)
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

/* --------------------------------------------------------------------- notes */

const NOTES_KEY = 'subzer0.notes'
const NOTES_OPEN_KEY = 'subzer0.notes-open'

function readStore(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* memory-only is fine */
  }
}

function loadNotes() {
  try {
    const list = JSON.parse(readStore(NOTES_KEY) ?? '[]')
    if (!Array.isArray(list)) return []
    return list
      .filter((note) => note && typeof note.text === 'string' && note.text.trim())
      .map((note) => ({
        id: String(note.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        text: note.text,
      }))
      .slice(0, 200)
  } catch {
    return []
  }
}

let notes = loadNotes()
let notesOpen = readStore(NOTES_OPEN_KEY) !== '0'

function persistNotes() {
  writeStore(NOTES_KEY, JSON.stringify(notes))
}

function applyNotesOpen() {
  el.shell.dataset.notes = notesOpen ? 'on' : 'off'
  el.notesToggle.setAttribute('aria-pressed', String(notesOpen))
  el.notesToggle.title = notesOpen ? 'hide notes' : 'show notes'
}

function addNote(text) {
  const clean = text.trim()
  if (!clean) return
  notes.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: clean })
  notes = notes.slice(0, 200)
  persistNotes()
  renderNotes()
}

function removeNote(id) {
  notes = notes.filter((note) => note.id !== id)
  persistNotes()
  renderNotes()
}

function useNote(note) {
  const current = el.input.value.trim()
  el.input.value = current ? `${current} ${note.text}` : note.text
  el.input.focus()
  el.input.setSelectionRange(el.input.value.length, el.input.value.length)
  autosize()
}

function renderNotes() {
  el.notesCount.textContent = notes.length ? String(notes.length) : ''

  if (!notes.length) {
    el.notesList.innerHTML = '<p class="notes-empty">no notes yet</p>'
    return
  }

  const frag = document.createDocumentFragment()
  for (const note of notes) {
    const row = document.createElement('div')
    row.className = 'note-row'

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'note'
    button.textContent = note.text
    button.title = 'add to the composer'
    button.addEventListener('click', () => useNote(note))

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'note-del'
    del.title = 'delete note'
    del.setAttribute('aria-label', 'delete note')
    del.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="m2.5 2.5 5 5m0-5-5 5"/></svg>'
    del.addEventListener('click', (event) => {
      event.stopPropagation()
      removeNote(note.id)
    })

    row.append(button, del)
    frag.appendChild(row)
  }

  el.notesList.replaceChildren(frag)
}

/* -------------------------------------------------------------------- models */

const GROUPS = [
  { plan: 'free', label: 'free', hint: 'no subscription needed' },
  { plan: 'go', label: 'opencode go', hint: '' },
  { plan: 'paid', label: 'pay per token', hint: 'billed to your opencode balance' },
]

function goHint() {
  if (goStatus === 'inactive') return 'not active on this account'
  if (goStatus === 'active') return 'active on this account'
  return 'included in your subscription'
}

function modelMeta(model) {
  if (model.plan === 'paid') {
    const { input, output } = model.price ?? {}
    return input || output ? `$${input} / $${output} per m` : 'metered'
  }
  return model.context ? `${Math.round(model.context / 1000)}k` : ''
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
      modelsLoaded ? 'no models available.' : 'loading…'
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
    empty.textContent = `no model matches “${modelQuery.trim()}”.`
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

function renderPersonality() {
  const persona = PERSONAS.find((p) => p.id === settings.personality) ?? PERSONAS[0]
  el.personalityNote.textContent = persona.note || ''
  renderSegments(el.personalities, PERSONAS, settings.personality, (id) => save({ personality: id }))
}

/* ------------------------------------------------------------------ updates */

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
  renderUpdate()
}

async function applyUpdate() {
  if (updateBusy || !window.conv.updates) return
  updateBusy = true
  updateNote = 'downloading…'
  renderUpdate()

  try {
    const result = await window.conv.updates.apply()
    if (result && result.ok === false) {
      updateBusy = false
      updateNote = result.reason || 'update failed'
      renderUpdate()
    }
  } catch (cause) {
    updateBusy = false
    updateNote = String(cause?.message ?? cause)
    renderUpdate()
  }
}

function renderUpdate() {
  if (!el.updateBtn) return
  if (updateBusy) {
    el.updateBtn.textContent = updateNote || 'updating…'
    el.updateBtn.disabled = true
    el.updateBtn.hidden = false
  } else if (release?.available) {
    el.updateBtn.textContent = `update to v${release.latest}`
    el.updateBtn.disabled = false
    el.updateBtn.hidden = false
  } else {
    el.updateBtn.hidden = true
  }
}

/* ------------------------------------------------------------------- messages */

function intro() {
  const wrap = document.createElement('div')
  wrap.className = 'intro'

  const modelName = (selectedModel()?.name || settings.model?.id || 'the model').toLowerCase()

  const title = document.createElement('h1')
  title.textContent = 'what are we building?'

  const line = document.createElement('p')
  line.textContent =
    `type what you want and ${modelName} will change it right here — layout, colors, whatever.`

  const examplesLabel = document.createElement('div')
  examplesLabel.className = 'intro-examples'
  examplesLabel.textContent = 'examples:'

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

  wrap.append(title, line, examplesLabel, hints)
  return wrap
}

/** Reasoning blocks the user collapsed, keyed by assistant message id. */
const collapsedThoughts = new Set()
/** Messages whose finished thoughts have already been compacted automatically. */
const settledThoughts = new Set()

function renderMessages() {
  const stick = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 90
  el.log.replaceChildren()

  const shown = visibleMessages()

  if (!shown.length && !busy && !pending && !error && !notice) {
    el.log.appendChild(intro())
    return
  }

  let lastAssistantId = null
  for (const message of shown) {
    if (message.type === 'assistant') lastAssistantId = message.id
  }

  for (const [messageIndex, message] of shown.entries()) {
    if (message.type === 'user') {
      const text = cleanUserText(message.text ?? message.payload?.text)
      if (!text) continue
      const bubble = document.createElement('div')
      bubble.className = 'msg user'
      bubble.textContent = text
      el.log.appendChild(bubble)
      continue
    }

    if (message.type !== 'assistant') continue

    const thoughtParts = []
    const textParts = []
    for (const part of message.content ?? []) {
      if (part.type === 'reasoning' || part.type === 'thinking') {
        if (part.text && part.text.trim()) thoughtParts.push(part.text.trim())
        continue
      }
      if (part.type === 'text' && part.text && part.text.trim()) textParts.push(part.text)
    }

    if (thoughtParts.length) {
      const key = message.id ?? `assistant-${messageIndex}`
      const settled = message.id !== lastAssistantId || !busy
      if (settled && !settledThoughts.has(key)) {
        settledThoughts.add(key)
        collapsedThoughts.add(key)
      }

      const thoughtText = thoughtParts.join('\n\n')
      const block = document.createElement('div')
      block.className = 'msg thinking'
      block.setAttribute('role', 'button')
      block.tabIndex = 0
      const collapsed = collapsedThoughts.has(key)
      block.classList.toggle('collapsed', collapsed)
      block.setAttribute('aria-expanded', String(!collapsed))
      block.title = collapsed ? 'show thoughts' : 'hide thoughts'
      block.textContent = collapsed ? 'thoughts' : thoughtText

      const toggle = () => {
        if (collapsedThoughts.has(key)) collapsedThoughts.delete(key)
        else collapsedThoughts.add(key)
        const next = collapsedThoughts.has(key)
        block.classList.toggle('collapsed', next)
        block.setAttribute('aria-expanded', String(!next))
        block.title = next ? 'show thoughts' : 'hide thoughts'
        block.textContent = next ? 'thoughts' : thoughtText
      }

      block.addEventListener('click', toggle)
      block.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle()
        }
      })
      el.log.appendChild(block)
    }

    for (const text of textParts) renderAssistantText(el.log, text)
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
    indicator.innerHTML =
      '<span class="working-label">thinking</span><span class="dot"></span><span class="dot"></span><span class="dot"></span>'
    // Anchor the animations to the wall clock so they do not restart on each render.
    const now = Date.now()
    indicator.querySelector('.working-label').style.animationDelay = `-${now % 2400}ms`
    indicator.querySelectorAll('.dot').forEach((dot, index) => {
      const phase = (((now - index * 160) % 1200) + 1200) % 1200
      dot.style.animationDelay = `-${phase}ms`
    })
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
      action.textContent = 'choose a model'
      action.addEventListener('click', () => void openSheet())
      line.appendChild(action)
    }

    el.log.appendChild(line)
  }

  if (notice) {
    const line = document.createElement('div')
    line.className = 'notice'
    line.textContent = notice
    el.log.appendChild(line)
  }

  if (stick) el.log.scrollTop = el.log.scrollHeight
}

function formatCost(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(6)}`
}

function renderSpend() {
  const text = formatCost(lastCost)
  el.spend.textContent = text
  el.spend.title = text ? `spent this conversation · ${text}` : ''
  el.spend.hidden = !text
  el.meter.hidden = !settings.showTokens && !(lastCost > 0)
}

function renderAssistantText(container, text) {
  const parts = text.split(/```/)
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const pre = document.createElement('pre')
      pre.className = 'code'
      const code = document.createElement('code')
      code.textContent = parts[i].replace(/^[^\n]*\n/, '')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy'
      btn.textContent = 'copy'
      btn.addEventListener('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(code.textContent).catch(() => {})
        btn.textContent = 'copied'
        setTimeout(() => (btn.textContent = 'copy'), 1200)
      })
      pre.append(btn, code)
      container.appendChild(pre)
    } else if (parts[i].trim()) {
      const bubble = document.createElement('div')
      bubble.className = 'msg assistant'
      bubble.textContent = parts[i]
      container.appendChild(bubble)
    }
  }
}

function renderCmdMenu() {
  const value = el.input.value
  if (!value.startsWith('?') || value.includes(' ')) {
    el.cmdMenu.hidden = true
    return
  }
  const frag = document.createDocumentFragment()
  for (const cmd of COMMANDS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cmd-item'
    btn.textContent = `?${cmd}`
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault()
      el.input.value = `?${cmd} `
      el.input.focus()
      autosize()
      el.cmdMenu.hidden = true
    })
    frag.appendChild(btn)
  }
  el.cmdMenu.replaceChildren(frag)
  el.cmdMenu.hidden = false
}

function renderTokens(tokens, cost) {
  if (tokens) lastTokens = tokens
  if (typeof cost === 'number') lastCost = cost
  renderSpend()
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
}

/* --------------------------------------------------------------------- sheet */

async function openSheet() {
  if (!el.sheet.open) el.sheet.showModal()
  applySettings()

  if (modelsLoaded) return

  el.models.innerHTML = '<p class="empty">loading…</p>'
  try {
    models = (await window.conv.models.list()) ?? []
  } catch (cause) {
    models = []
    modelsLoaded = true
    el.models.innerHTML = `<p class="empty">could not load models: ${String(
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

function setSendBusy(on) {
  el.send.classList.toggle('busy', on)
  el.send.title = on ? 'stop' : 'send (enter)'
  el.send.setAttribute('aria-label', on ? 'stop' : 'send')
}

function showNotice(text) {
  notice = text
  error = null
  renderMessages()
}

function handleCommand(text) {
  const parts = text.slice(1).trim().split(/\s+/)
  const name = (parts[0] || '').toLowerCase()
  const arg = parts.slice(1).join(' ').trim()

  switch (name) {
    case 'persona': {
      const id = arg.toLowerCase()
      if (!id) {
        const current = PERSONAS.find((p) => p.id === settings.personality)
        showNotice(`persona: ${current?.name ?? 'balanced'} · ${PERSONAS.map((p) => p.id).join(', ')}`)
      } else if (PERSONAS.some((p) => p.id === id)) {
        void save({ personality: id })
        showNotice(`persona set to ${id}`)
      } else {
        showNotice(`unknown persona · try ${PERSONAS.map((p) => p.id).join(', ')}`)
      }
      return
    }
    case 'effort': {
      const variants = ['default', ...(selectedModel()?.variants ?? [])]
      if (!arg) {
        showNotice(`effort: ${settings.model.variant} · ${variants.join(', ')}`)
      } else {
        void save({ model: { variant: arg } })
        showNotice(`effort set to ${arg}`)
      }
      return
    }
    case 'model': {
      if (!arg) {
        showNotice(`model: ${selectedModel()?.name ?? settings.model.id}`)
      } else {
        const m = models.find(
          (x) =>
            x.name.toLowerCase().includes(arg.toLowerCase()) ||
            x.id.toLowerCase().includes(arg.toLowerCase())
        )
        if (m) {
          const keep =
            settings.model.variant === 'default' || m.variants.includes(settings.model.variant)
          void save({ model: { providerID: m.providerID, id: m.id, variant: keep ? settings.model.variant : 'default' } })
          showNotice(`model set to ${m.name}`)
        } else {
          showNotice(`no model matches "${arg}"`)
        }
      }
      return
    }
    case 'version': {
      showNotice(`subzer0 · ${selectedModel()?.name ?? settings.model.id} · ${settings.model.variant}`)
      return
    }
    case 'compact': {
      compact = !compact
      try {
        window.localStorage.setItem(COMPACT_KEY, compact ? '1' : '0')
      } catch {
        /* memory-only is fine */
      }
      applyCompact()
      showNotice(`compact ${compact ? 'on' : 'off'}`)
      return
    }
    case 'clear': {
      const last = messages[messages.length - 1]
      if (sessionID && last?.id) {
        clearedMessages[sessionID] = last.id
        saveCleared()
      }
      showNotice('chat cleared · context kept')
      return
    }
    default:
      showNotice('unknown command · try ?persona ?effort ?model ?version ?compact ?clear')
  }
}

async function submit() {
  const text = el.input.value.trim()
  if (!text || busy) return

  if (text.startsWith('?')) {
    el.input.value = ''
    autosize()
    handleCommand(text)
    return
  }

  error = null
  notice = null
  errorAt = 0
  pending = text
  el.input.value = ''
  autosize()
  busy = true
  setSendBusy(true)
  renderMessages()

  try {
    const result = await window.conv.send(withContext(text))
    if (result && result.ok === false) {
      error = {
        message: result.reason
          ? `this copy has no ai attached (${result.reason}).`
          : 'this copy has no ai attached.',
      }
      busy = false
      pending = null
      setSendBusy(false)
      renderMessages()
    }
  } catch (cause) {
    error = { message: String(cause?.message ?? cause) }
    busy = false
    pending = null
    setSendBusy(false)
    renderMessages()
  }
}

function autosize() {
  el.input.style.height = 'auto'
  el.input.style.height = Math.min(220, el.input.scrollHeight) + 'px'
}

/* ----------------------------------------------------------------------- wire */

// Boot splash: hold for 3s, then fade out and remove.
const bootEl = document.getElementById('boot')
if (bootEl) {
  setTimeout(() => {
    bootEl.classList.add('hide')
    setTimeout(() => bootEl.remove(), 600)
  }, 3000)
}

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

el.input.addEventListener('input', () => {
  autosize()
  renderCmdMenu()
})

el.cmdMenu.addEventListener('click', () => {
  el.cmdMenu.hidden = true
})

el.custom.addEventListener('input', () => {
  customInstructions = el.custom.value
  persistCustom()
})

el.gear.addEventListener('click', () => void openSheet())
el.modelChip.addEventListener('click', () => void openSheet())
el.close.addEventListener('click', closeSheet)

el.notesToggle.addEventListener('click', () => {
  notesOpen = !notesOpen
  writeStore(NOTES_OPEN_KEY, notesOpen ? '1' : '0')
  applyNotesOpen()
})

el.noteForm.addEventListener('submit', (event) => {
  event.preventDefault()
  addNote(el.noteInput.value)
  el.noteInput.value = ''
  el.noteInput.focus()
})

applyNotesOpen()
renderNotes()

el.sheet.addEventListener('click', (event) => {
  if (event.target === el.sheet) closeSheet()
})

el.newChat.addEventListener('click', () => {
  void window.conv.newChat()
})

el.send.addEventListener('click', (event) => {
  if (busy) {
    event.preventDefault()
    void window.conv.stop()
  }
})

el.updateBtn?.addEventListener('click', () => void applyUpdate())

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
  el.clearAll.textContent = 'clear all'
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
  el.clearAll.textContent = 'sure? tap again'
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

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[880, 1174.66].forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.start(t)
      o.stop(t + 0.4)
    })
  } catch {
    /* audio unavailable */
  }
}

function notifyDone() {
  try {
    if (window.Notification && Notification.permission === 'granted') {
      new Notification('subzer0', { body: 'done' })
    } else if (window.Notification && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  } catch {
    /* notifications unavailable */
  }
  playChime()
}

window.conv.onUpdate((update) => {
  const prevBusy = busy
  messages = update.messages ?? []
  busy = Boolean(update.busy)
  pending = null
  notice = null
  if (update.settings) settings = update.settings
  if (update.providers?.go) goStatus = update.providers.go
  if (update.sessionID) sessionID = update.sessionID

  if (error && messages.length > errorAt) {
    error = null
    errorAt = 0
  }

  if (prevBusy && !busy && messages.length) notifyDone()

  setSendBusy(busy)
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
  el.sessionTitle.textContent = current?.title || 'new chat'
})

window.conv.onError((payload) => {
  error = { message: payload?.message ?? String(payload), kind: payload?.kind }
  errorAt = messages.length
  renderMessages()
})

window.conv.onUpdateProgress?.((payload) => {
  if (payload?.message) {
    updateNote = payload.message
    renderUpdate()
  }
})

// Re-check for new releases once in a while without waiting for a reload.
setInterval(() => void checkForUpdate(), 6 * 60 * 60 * 1000)

window.conv.init().then(async (result) => {
  if (result?.settings) {
    settings = result.settings
  }
  // restore the last-chosen personality; the host may not carry it across reloads.
  const stored = storedPersonality()
  if (PERSONAS.some((p) => p.id === stored)) settings.personality = stored
  normalizePersonality()
  customInstructions = loadCustom()
  // Undo the earlier one-time violet default, then forget it.
  try {
    if (window.localStorage.getItem(ACCENT_KEY) === '1') {
      settings.accent = 'slate'
      window.localStorage.removeItem(ACCENT_KEY)
      void window.conv.settings.set({ accent: 'slate' })
    }
  } catch {
    /* nothing to restore */
  }
  if (result?.sessionID) sessionID = result.sessionID
  if (Array.isArray(result?.sessions)) sessions = result.sessions

  applySettings()
  refreshSessions()
  void checkForUpdate()

  const current = sessions.find((session) => session.id === sessionID)
  el.sessionTitle.textContent = current?.title || 'new chat'

  // Fetch the model list once so the settings sheet is instant.
  try {
    models = (await window.conv.models.list()) ?? []
    modelsLoaded = true
    applySettings()
    renderMessages()
  } catch {
    /* the sheet will retry */
  }
})
