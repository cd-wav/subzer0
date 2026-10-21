'use strict'

const { app, BrowserWindow, ipcMain, protocol, dialog, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const oc = require('./opencode')
const { exportApp } = require('./export')
const { ROOT, APP_DIR, SETTINGS, ensureSandbox, resetApp } = require('./sandbox')

/** Preferred model. Falls back to the user's configured default if missing. */
const DEFAULT_MODEL = { providerID: 'opencode', id: 'deepseek-v4.1-flash-free', variant: 'default' }
const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  theme: 'dark',
  showTokens: false,
  budget: 200_000,
}

/** @type {BrowserWindow | null} */
let win = null
let sessionID = null
let settings = structuredClone(DEFAULT_SETTINGS)
let running = false
let refreshTimer = null
let watcher = null
let reloadTimer = null
let modelsCache = { at: 0, models: [] }

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'preview',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])

// Opt-in devtools protocol for debugging the generated app:
//   $env:CONV_DEBUG_PORT=9222; npm run dev
if (process.env.CONV_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.CONV_DEBUG_PORT)
}

/* ------------------------------------------------------------------- window */

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#000000',
    show: false,
    title: 'subzer0',
    icon: path.join(ROOT, 'assets', 'subzer0.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('preview://app/')) event.preventDefault()
  })

  // Diagnostics: surface renderer problems in the terminal instead of only in
  // devtools, since this app has no devtools chrome.
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[renderer] failed to load ${url}: ${description} (${code})`)
  })
  win.webContents.on('preload-error', (_event, file, error) => {
    console.error(`[preload] ${file}:`, error)
  })
  win.webContents.on('console-message', (...args) => {
    const details = args[1]
    if (details && typeof details === 'object' && details.message) {
      console.log(`[renderer:${details.level}] ${details.message}`)
    }
  })

  void win.loadURL('preview://app/index.html')
  win.on('closed', () => {
    win = null
  })
}

/** The app's files changed on disk — reload so the user sees the change. */
function queueReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    if (win && !win.isDestroyed()) win.webContents.reload()
  }, 500)
}

function watchAppDir() {
  if (watcher) return
  try {
    watcher = fs.watch(APP_DIR, { recursive: true }, () => {
      send('sandbox:changed', {})
      queueReload()
    })
  } catch (error) {
    console.error('watch failed', error)
  }
}

/* ------------------------------------------------------------------ preview */

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
}

function registerPreviewProtocol() {
  protocol.handle('preview', async (request) => {
    const url = new URL(request.url)
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '') rel = '/index.html'
    const full = path.normalize(path.join(APP_DIR, rel))
    if (!full.startsWith(APP_DIR)) {
      return new Response('forbidden', { status: 403 })
    }
    try {
      // Read from disk on every request. `net.fetch(file://…)` caches, which
      // made the window keep showing stale HTML/CSS after the AI edited files.
      const body = await fsp.readFile(full)
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': CONTENT_TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store, no-cache, must-revalidate',
        },
      })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}

/* ---------------------------------------------------------------- app state */

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function scheduleRefresh(delay = 120) {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void pushState()
  }, delay)
}

async function pushState() {
  if (!sessionID) return
  try {
    const [messages, info] = await Promise.all([
      oc.listMessages(sessionID),
      oc.getSession(sessionID),
    ])
    send('app:update', {
      messages,
      tokens: info.tokens,
      cost: info.cost,
      budget: settings.budget,
      settings,
      busy: running,
      sessionID,
    })
  } catch (error) {
    send('app:error', { message: String(error && error.message ? error.message : error) })
  }
}

const TERMINAL_EVENTS = new Set([
  'session.execution.succeeded',
  'session.execution.failed',
  'session.execution.interrupted',
  'session.idle',
])

function sessionIdOf(event) {
  return event?.data?.sessionID ?? event?.data?.session?.id ?? null
}

async function startEventStream() {
  try {
    await oc.subscribe(async (event) => {
      const sid = sessionIdOf(event)
      if (!sid || sid !== sessionID) return

      if (event.type === 'permission.asked') {
        // The sandbox config denies anything risky. Anything still asking
        // (e.g. reading a .env file) is rejected rather than silently allowed.
        oc.replyPermission(sessionID, event.data.id, 'reject').catch(() => {})
        send('app:error', {
          message: `Blocked ${event.data.action} on ${(event.data.resources || []).join(', ')}`,
        })
        return
      }

      if (TERMINAL_EVENTS.has(event.type)) {
        running = false
        scheduleRefresh(0)
        return
      }

      scheduleRefresh()
    })
  } catch (error) {
    send('app:error', {
      message: `Lost connection to OpenCode: ${error && error.message ? error.message : error}`,
    })
    setTimeout(startEventStream, 2000)
  }
}

/* ----------------------------------------------------------------- sessions */

/** `variant: 'default'` means "no explicit reasoning effort". */
function modelRef({ providerID, id, variant }) {
  const ref = { providerID, id }
  if (variant && variant !== 'default') ref.variant = variant
  return ref
}

async function ensureSession() {
  if (sessionID) {
    // A stored session can disappear (OpenCode reset, service change); only
    // trust it if the server still knows about it.
    try {
      await oc.getSession(sessionID)
      return sessionID
    } catch {
      sessionID = null
    }
  }
  try {
    const created = await oc.createSession({
      directory: APP_DIR,
      title: 'subzer0',
      model: modelRef(settings.model),
    })
    sessionID = created.id
  } catch {
    // Model unavailable on this machine — fall back to the user's default.
    const created = await oc.createSession({ directory: APP_DIR, title: 'subzer0' })
    sessionID = created.id
  }
  await saveSettings()
  return sessionID
}

/**
 * Rough size of the prompt the next request will send. The agent pays for the
 * whole conversation every turn, so this is what actually eats tokens.
 */
function estimateContext(messages) {
  let chars = 0
  for (const message of messages) {
    if (message.type === 'user') {
      chars += (message.text ?? '').length
      continue
    }
    for (const part of message.content ?? []) {
      chars += (part.text ?? '').length
      if (part.state) chars += JSON.stringify(part.state).length
    }
  }
  return Math.round(chars / 4)
}

const COMPACT_AT = 60_000

/** Summarise the conversation before a prompt when it has grown expensive. */
async function maybeCompact() {
  if (!sessionID) return false
  try {
    const messages = await oc.listMessages(sessionID)
    const estimate = estimateContext(messages)
    if (estimate < COMPACT_AT) return false
    send('app:compact', { estimate })
    await oc.compactSession(sessionID)
    return true
  } catch {
    return false
  }
}

/** Apply model + reasoning changes to the live session, keeping its history. */
async function applyModel() {
  if (!sessionID) return true
  try {
    await oc.switchModel(sessionID, modelRef(settings.model))
    return true
  } catch (error) {
    send('app:error', {
      message: `Could not switch model: ${error && error.message ? error.message : error}`,
    })
    return false
  }
}

function sanitizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {}
  const model = source.model && typeof source.model === 'object' ? source.model : {}
  const budget = Number(source.budget)
  const text = (input, fallback) =>
    typeof input === 'string' && input.length ? input : fallback

  return {
    model: {
      providerID: text(model.providerID, DEFAULT_MODEL.providerID),
      id: text(model.id, DEFAULT_MODEL.id),
      variant: text(model.variant, 'default'),
    },
    theme: text(source.theme, DEFAULT_SETTINGS.theme),
    showTokens: source.showTokens === true,
    budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : DEFAULT_SETTINGS.budget,
  }
}

async function loadSettings() {
  try {
    const parsed = JSON.parse(await fsp.readFile(SETTINGS, 'utf8'))
    settings = sanitizeSettings(parsed)
    if (typeof parsed.sessionID === 'string' && parsed.sessionID.startsWith('ses')) {
      sessionID = parsed.sessionID
    }
  } catch {
    /* defaults are fine */
  }
}

async function saveSettings() {
  const payload = sessionID ? { ...settings, sessionID } : settings
  await fsp.writeFile(SETTINGS, JSON.stringify(payload, null, 2), 'utf8')
}

/* ---------------------------------------------------------------------- ipc */

ipcMain.handle('app:init', async () => {
  await ensureSandbox()
  await loadSettings()
  await ensureSession()
  const [info, model] = await Promise.all([
    oc.serverInfo().catch((e) => ({ error: String(e && e.message ? e.message : e) })),
    oc.defaultModel(APP_DIR).catch(() => null),
  ])
  await pushState()
  return { sessionID, settings, model, server: info, cli: oc.findCli() }
})

ipcMain.handle('settings:get', () => settings)

ipcMain.handle('settings:set', async (_event, patch) => {
  const previous = settings
  const incoming = patch && typeof patch === 'object' ? patch : {}
  settings = sanitizeSettings({
    ...settings,
    ...incoming,
    model: { ...settings.model, ...(incoming.model ?? {}) },
  })
  await saveSettings()

  const changed =
    previous.model.providerID !== settings.model.providerID ||
    previous.model.id !== settings.model.id ||
    previous.model.variant !== settings.model.variant
  if (changed) await applyModel()

  send('app:settings', settings)
  await pushState()
  return settings
})

ipcMain.handle('models:list', async () => {
  if (Date.now() - modelsCache.at < 10_000) return modelsCache.models
  try {
    const models = await oc.listModels()
    modelsCache = { at: Date.now(), models }
    return models
  } catch (error) {
    send('app:error', {
      message: `Could not list models: ${error && error.message ? error.message : error}`,
    })
    return []
  }
})

ipcMain.handle('chat:send', async (_event, text) => {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return { ok: false }
  await ensureSession()
  await maybeCompact()
  running = true
  await oc.prompt(sessionID, trimmed)
  await pushState()
  return { ok: true }
})

ipcMain.handle('chat:stop', async () => {
  if (!sessionID) return { ok: false }
  await oc.interrupt(sessionID).catch(() => {})
  running = false
  await pushState()
  return { ok: true }
})

ipcMain.handle('chat:reset', async () => {
  if (sessionID) await oc.interrupt(sessionID).catch(() => {})
  sessionID = null
  running = false
  await resetApp()
  await ensureSession()
  await pushState()
  send('sandbox:changed', {})
  queueReload()
  return { ok: true }
})

ipcMain.handle('build:export', async () => {
  const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist')
  const outDir = path.join(ROOT, 'out')

  try {
    const result = await exportApp({
      appDir: APP_DIR,
      electronDist,
      outDir,
      name: 'subzer0',
      onProgress: (message) => send('build:status', { message }),
    })
    send('build:status', { message: '', done: true })

    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Built',
      message: 'Your app is ready.',
      detail: result.exe,
      buttons: ['Show in folder', 'OK'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) shell.showItemInFolder(result.exe)
    return { ok: true, ...result }
  } catch (error) {
    send('build:status', { message: '', done: true })
    const message = error && error.message ? error.message : String(error)
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Build failed',
      message: 'Could not build the app.',
      detail: message,
    })
    return { ok: false, reason: message }
  }
})

ipcMain.handle('budget:set', async (_event, value) => {
  const next = Number(value)
  if (Number.isFinite(next) && next > 0) {
    settings = sanitizeSettings({ ...settings, budget: next })
    await saveSettings()
    await pushState()
  }
  return { budget: settings.budget }
})

/* --------------------------------------------------------------------- boot */

// Keep dev and installed builds out of each other's caches. Without this the
// two share %APPDATA%\subzer0 and Chromium fails to take the cache lock.
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'subzer0-dev'))
}

// One window per machine: launching again focuses the window that is already
// open instead of starting a second instance.
const primary = app.requestSingleInstanceLock()

if (!primary) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.whenReady().then(async () => {
    registerPreviewProtocol()
    await ensureSandbox()
    watchAppDir()
    startEventStream()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (watcher) watcher.close()
})
