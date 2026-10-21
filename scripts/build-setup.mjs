// Build `out/setup/subzer0 Setup.exe` — a self-contained installer for the app
// as it exists in sandbox/app right now.
//
//   node scripts/build-setup.mjs           build the setup folder
//   node scripts/build-setup.mjs --zip     also produce a distributable zip
//
// No network and no NSIS: the setup is an Electron app that copies its own
// runtime plus the bundled payload into %LOCALAPPDATA%\Programs\subzer0.

import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { stamp } from './stamp-icon.mjs'

const run = promisify(execFile)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(ROOT, 'sandbox', 'app')
const INSTALLER_DIR = path.join(ROOT, 'installer')
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist')
const OUT = path.join(ROOT, 'out', 'setup')
const EXE_NAME = 'subzer0 Setup.exe'

const INSTALLER_FILES = ['main.js', 'preload.js', 'index.html', 'styles.css', 'ui.js', 'package.json']

// The installed app runs the real host, not the export stub: it needs the
// Electron entry points, the seed app, the icon, and the runtime deps.
const PAYLOAD_FILES = ['package.json']
const PAYLOAD_DIRS = ['electron', 'assets']
const PAYLOAD_MODULES = [
  '@opencode/client',
  '@opencode/protocol',
  '@opencode/schema',
  '@standard-schema/spec',
  'effect',
]

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function dirSize(dir) {
  let total = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) total += await dirSize(full)
    else {
      try {
        total += (await stat(full)).size
      } catch {
        /* ignore */
      }
    }
  }
  return total
}

/** Copy the host app (minus dev-only bits) into the installer payload. */
async function writePayload(target) {
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })

  for (const file of PAYLOAD_FILES) {
    await cp(path.join(ROOT, file), path.join(target, file))
  }
  for (const dir of PAYLOAD_DIRS) {
    await cp(path.join(ROOT, dir), path.join(target, dir), { recursive: true })
  }

  const modules = path.join(target, 'node_modules')
  await mkdir(modules, { recursive: true })
  for (const name of PAYLOAD_MODULES) {
    const from = path.join(ROOT, 'node_modules', name)
    if (!(await exists(from))) throw new Error(`missing runtime dependency: ${name}`)
    await cp(from, path.join(modules, name), { recursive: true })
  }

  return target
}

async function main() {
  const zip = process.argv.includes('--zip')

  if (!(await exists(ELECTRON_DIST))) {
    throw new Error(`Electron runtime missing at ${ELECTRON_DIST} — run npm install first`)
  }
  if (!(await exists(path.join(APP_DIR, 'index.html')))) {
    throw new Error('No app in sandbox/app yet — run the app once first')
  }

  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const version = pkg.version || '0.1.0'

  console.log('· clearing', path.relative(ROOT, OUT))
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  console.log('· copying runtime')
  await cp(ELECTRON_DIST, OUT, { recursive: true })
  await rm(path.join(OUT, 'resources', 'default_app.asar'), { force: true })
  await rename(path.join(OUT, 'electron.exe'), path.join(OUT, EXE_NAME))

  console.log('· stamping icon + version')
  await stamp(path.join(OUT, EXE_NAME), version)

  console.log('· bundling setup wizard')
  const installerApp = path.join(OUT, 'resources', 'app')
  await mkdir(installerApp, { recursive: true })
  for (const file of INSTALLER_FILES) {
    await cp(path.join(INSTALLER_DIR, file), path.join(installerApp, file))
  }
  await cp(path.join(ROOT, 'assets', 'subzer0.png'), path.join(installerApp, 'icon.png'))

  // stamp the version the wizard shows
  const setupPkg = JSON.parse(await readFile(path.join(installerApp, 'package.json'), 'utf8'))
  setupPkg.version = version
  await writeFile(path.join(installerApp, 'package.json'), JSON.stringify(setupPkg, null, 2), 'utf8')

  console.log('· bundling app payload')
  const payload = await writePayload(path.join(OUT, 'resources', 'payload', 'app'))

  const size = await dirSize(OUT)
  console.log(`· setup folder ready (${(size / 1024 / 1024).toFixed(0)} MB)`)
  console.log(`  ${path.join(OUT, EXE_NAME)}`)
  console.log(`  payload: ${payload}`)

  if (zip) {
    const zipPath = path.join(ROOT, 'out', `subzer0-Setup-${version}-win-x64.zip`)
    await rm(zipPath, { force: true })
    console.log('· compressing for distribution…')
    await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal`,
    ])
    const zipSize = (await stat(zipPath)).size
    console.log(`  ${zipPath} (${(zipSize / 1024 / 1024).toFixed(0)} MB)`)
  }
}

main().catch((error) => {
  console.error('setup build failed:', error.message)
  process.exit(1)
})
