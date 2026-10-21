'use strict'

const fsp = require('node:fs/promises')
const path = require('node:path')

/**
 * Turn the generated app into a standalone folder with its own .exe.
 *
 * There is no compiler and no network involved: we copy the Electron runtime
 * that ships in node_modules, rename its executable, and drop the generated
 * files in `resources/app` where Electron looks for them.
 */

const RUNTIME_MAIN = `'use strict'

const { app, BrowserWindow } = require('electron')
const path = require('node:path')

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    backgroundColor: '#0a0c10',
    preload: path.join(__dirname, 'preload.js'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, 'app', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
`

/**
 * Standalone builds have no AI host, but the app still expects
 * \`window.conv\`. This stub keeps exported apps working instead of throwing.
 */
const RUNTIME_PRELOAD = `'use strict'

const { contextBridge } = require('electron')

const settings = {
  model: { providerID: 'opencode', id: 'deepseek-v4.1-flash-free', variant: 'default' },
  theme: 'dark',
  showTokens: false,
  budget: 200000,
}

contextBridge.exposeInMainWorld('conv', {
  init: async () => ({ sessionID: null, settings, model: null, server: null, cli: null }),
  send: async () => ({ ok: false, reason: 'standalone build' }),
  stop: async () => ({ ok: false }),
  reset: async () => ({ ok: false }),
  exportApp: async () => ({ ok: false }),
  setBudget: async () => ({ budget: settings.budget }),
  settings: {
    get: async () => settings,
    set: async (patch) => Object.assign(settings, patch),
  },
  models: { list: async () => [], select: async () => settings },
  onSettings: () => {},
  onUpdate: () => {},
  onError: () => {},
  onSandboxChange: () => {},
  onBuildStatus: () => {},
})
`

function sanitize(name) {
  const cleaned = String(name || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'MyApp'
}

async function exists(target) {
  try {
    await fsp.access(target)
    return true
  } catch {
    return false
  }
}

function slugOf(name) {
  return (
    sanitize(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  )
}

/**
 * Write the `resources/app` payload: a tiny main process, the bridge stub, and
 * the generated app files. Used by both the export folder and the installer.
 */
async function writeRuntimeApp({ appDir, target, name }) {
  const slug = slugOf(name)
  await fsp.mkdir(target, { recursive: true })
  await fsp.writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({ name: slug, version: '1.0.0', main: 'main.js' }, null, 2)
  )
  await fsp.writeFile(path.join(target, 'main.js'), RUNTIME_MAIN)
  await fsp.writeFile(path.join(target, 'preload.js'), RUNTIME_PRELOAD)
  await fsp.cp(appDir, path.join(target, 'app'), { recursive: true })
  return target
}

/**
 * @param {object} options
 * @param {string} options.appDir      generated app (index.html, styles.css, app.js)
 * @param {string} options.electronDist directory containing the Electron runtime
 * @param {string} options.outDir      where the export folder is created
 * @param {string} [options.name]      display name / folder / exe name
 * @param {(message: string) => void} [options.onProgress]
 * @returns {Promise<{ directory: string, exe: string }>}
 */
async function exportApp({ appDir, electronDist, outDir, name, onProgress = () => {} }) {
  const label = sanitize(name)
  const directory = path.join(outDir, label)
  const exe = path.join(directory, `${label}.exe`)

  const runtimeExe = path.join(electronDist, 'electron.exe')
  if (!(await exists(runtimeExe))) {
    throw new Error(`Electron runtime not found at ${runtimeExe}`)
  }
  if (!(await exists(path.join(appDir, 'index.html')))) {
    throw new Error('The generated app has no index.html yet — ask the AI for something first.')
  }

  onProgress(`Preparing ${label}…`)
  await fsp.rm(directory, { recursive: true, force: true })
  await fsp.mkdir(directory, { recursive: true })

  onProgress('Copying runtime…')
  await fsp.cp(electronDist, directory, { recursive: true })

  onProgress('Writing executable…')
  const copiedExe = path.join(directory, 'electron.exe')
  if (await exists(copiedExe)) await fsp.rename(copiedExe, exe)

  const resources = path.join(directory, 'resources')
  await fsp.rm(path.join(resources, 'default_app.asar'), { force: true })

  onProgress('Bundling your app…')
  await writeRuntimeApp({ appDir, target: path.join(resources, 'app'), name: label })

  onProgress('Done')
  return { directory, exe }
}

module.exports = { exportApp, writeRuntimeApp, sanitize, slugOf, RUNTIME_MAIN, RUNTIME_PRELOAD }
