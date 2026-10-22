'use strict'

/**
 * subzer0 setup.
 *
 * A tiny Electron app that installs subzer0 into %LOCALAPPDATA%\Programs\subzer0:
 * it copies its own Electron runtime, drops the bundled app into
 * `resources/app`, creates shortcuts, and can launch it. No network, no
 * toolchain — the payload travels inside this folder.
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { spawn, execFile } = require('node:child_process')
const fsp = require('node:fs/promises')
const path = require('node:path')

const APP_NAME = 'subzer0'
const EXE_NAME = 'subzer0.exe'
const PAYLOAD = path.join(process.resourcesPath, 'payload', 'app')
const RUNTIME_ROOT = path.dirname(process.execPath)
const SKIP = new Set([
  path.join(RUNTIME_ROOT, 'resources', 'app'),
  path.join(RUNTIME_ROOT, 'resources', 'payload'),
])

// `--update`: a silent reinstall launched by the app itself; `--install-dir=`
// names the install location to refresh (defaults to the usual Programs dir).
const UPDATE_MODE = process.argv.includes('--update')
const DIR_ARG = process.argv.find((arg) => arg.startsWith('--install-dir='))
const INSTALL_DIR = DIR_ARG ? path.resolve(DIR_ARG.slice('--install-dir='.length)) : null

/** @type {BrowserWindow | null} */
let win = null
let busy = false
let installedExe = null

function createWindow() {
  win = new BrowserWindow({
    width: 640,
    height: 620,
    resizable: false,
    frame: false,
    show: false,
    backgroundColor: '#0a0a0b',
    title: 'subzer0 setup',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.loadFile(path.join(__dirname, 'index.html'))
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function defaultDir() {
  const base = process.env.LOCALAPPDATA || app.getPath('home')
  return path.join(base, 'Programs', APP_NAME)
}

async function walk(root) {
  const files = []

  async function visit(dir) {
    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name)
      if (SKIP.has(abs)) continue
      if (entry.isDirectory()) {
        await visit(abs)
      } else if (entry.isFile()) {
        try {
          const info = await fsp.stat(abs)
          files.push({ abs, rel: path.relative(root, abs), size: info.size })
        } catch {
          /* a file vanished mid-walk; ignore it */
        }
      }
    }
  }

  await visit(root)
  return files
}

async function payloadSize() {
  const files = await walk(PAYLOAD)
  return files.reduce((total, file) => total + file.size, 0)
}

function createShortcuts(exe, directory) {
  const quote = (value) => value.replace(/'/g, "''")
  const script = [
    '$ws = New-Object -ComObject WScript.Shell',
    "$dirs = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))",
    'foreach ($dir in $dirs) {',
    "  $lnk = Join-Path $dir 'subzer0.lnk'",
    '  $s = $ws.CreateShortcut($lnk)',
    `  $s.TargetPath = '${quote(exe)}'`,
    `  $s.WorkingDirectory = '${quote(directory)}'`,
    "  $s.Description = 'subzer0'",
    '  $s.Save()',
    '}',
  ].join('\n')

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      (error) => (error ? reject(error) : resolve())
    )
  })
}

async function install(target, report) {
  const runtime = await walk(RUNTIME_ROOT)
  const payload = await walk(PAYLOAD)
  const total = [...runtime, ...payload].reduce((sum, file) => sum + file.size, 0)

  // The setup exe is our own runtime renamed; the installed copy needs to be
  // called subzer0.exe no matter what this build is called.
  const runtimeExe = runtime.find(
    (file) => !file.rel.includes(path.sep) && file.rel.toLowerCase().endsWith('.exe')
  )

  report({ step: 'prepare', status: 'Preparing install location…', percent: 0 })
  await fsp.mkdir(target, { recursive: true })

  let copied = 0
  let lastReport = 0
  const started = Date.now()

  // The app being replaced may still be shutting down while we copy, so a
  // locked file is retried for a while instead of failing the whole install.
  const copyFileWithRetry = async (from, to) => {
    const deadline = Date.now() + 30_000
    for (;;) {
      try {
        await fsp.copyFile(from, to)
        return
      } catch (error) {
        const locked =
          error && (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES')
        if (!locked || Date.now() > deadline) throw error
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
    }
  }

  const copyOne = async (from, to, step) => {
    const info = await fsp.stat(from)
    await fsp.mkdir(path.dirname(to), { recursive: true })
    await copyFileWithRetry(from, to)
    copied += info.size

    const now = Date.now()
    if (now - lastReport > 60) {
      lastReport = now
      const elapsed = Math.max(1, (now - started) / 1000)
      report({
        step,
        file: path.basename(from),
        percent: total ? (copied / total) * 100 : 0,
        done: copied,
        total,
        speed: copied / elapsed,
      })
    }
  }

  for (const file of runtime) {
    const relative = runtimeExe && file.rel === runtimeExe.rel ? EXE_NAME : file.rel
    await copyOne(file.abs, path.join(target, relative), 'runtime')
  }

  report({ step: 'app', status: 'Installing app files…', percent: (copied / total) * 100 })
  for (const file of payload) {
    await copyOne(file.abs, path.join(target, 'resources', 'app', file.rel), 'app')
  }

  report({ step: 'shortcuts', status: 'Creating shortcuts…', percent: 100 })
  const exe = path.join(target, EXE_NAME)
  try {
    await createShortcuts(exe, target)
  } catch {
    /* shortcuts are a nicety; never fail the install over them */
  }

  installedExe = exe
  report({ step: 'done', status: 'Finished', percent: 100 })
  return exe
}

/* ---------------------------------------------------------------------- ipc */

ipcMain.handle('setup:info', async () => {
  const [size, version] = await Promise.all([
    payloadSize().catch(() => 0),
    Promise.resolve(app.getVersion()),
  ])
  return { defaultPath: defaultDir(), size, version, appName: APP_NAME }
})

ipcMain.handle('setup:choose', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose where to install subzer0',
    defaultPath: defaultDir(),
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('setup:install', async (event, target) => {
  if (busy) return { ok: false, reason: 'Install already running' }
  if (typeof target !== 'string' || !target.trim()) {
    return { ok: false, reason: 'Pick an install folder first' }
  }
  busy = true
  try {
    const exe = await install(
      path.resolve(target),
      (payload) => {
        if (!event.sender.isDestroyed()) event.sender.send('setup:progress', payload)
      }
    )
    return { ok: true, exe }
  } catch (error) {
    return { ok: false, reason: String((error && error.message) || error) }
  } finally {
    busy = false
  }
})

ipcMain.handle('setup:launch', async () => {
  if (!installedExe) return { ok: false }
  spawn(installedExe, [], { detached: true, stdio: 'ignore' }).unref()
  setTimeout(() => app.quit(), 400)
  return { ok: true }
})

ipcMain.handle('setup:open', async () => {
  if (!installedExe) return { ok: false }
  shell.showItemInFolder(installedExe)
  return { ok: true }
})

ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:close', () => app.quit())

/**
 * Silent reinstall: refresh the installed app in place, then relaunch it.
 * The user's sandbox (app files, settings, sessions) is not part of the
 * payload, so it survives the update untouched.
 */
async function runUpdate() {
  const target = INSTALL_DIR || defaultDir()
  const exe = path.join(target, EXE_NAME)
  try {
    await install(target, () => {})
  } catch (error) {
    console.error('update failed:', (error && error.message) || error)
    // The old app already quit; bring up whatever is installed now.
  }
  try {
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
  } catch (error) {
    console.error('relaunch failed:', (error && error.message) || error)
  }
  setTimeout(() => app.quit(), 400)
}

/* --------------------------------------------------------------------- boot */

app.whenReady().then(() => {
  if (UPDATE_MODE) {
    void runUpdate()
    return
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => app.quit())
