'use strict'

/**
 * Self-update: check GitHub for a newer subzer0 release, download the setup
 * exe and run it in `--update` mode — a silent reinstall that overwrites the
 * host while leaving the user's sandbox (app files, settings, sessions)
 * untouched, then relaunches.
 *
 * The download streams straight from the GitHub API using the gh CLI's token,
 * so it reports real progress and resumes a partial file instead of starting
 * over. `gh release download` is kept as a fallback.
 */

const { app } = require('electron')
const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')
const { once } = require('node:events')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const run = promisify(execFile)

/** Private repo — asset downloads need the gh CLI's credentials. */
const REPO = 'cd-wav/subzer0'
/** The raw setup exe published next to the zip; the full-reinstall fallback. */
const assetName = (version) => `subzer0-Setup-${version}-win-x64.exe`
/** A tiny zip of just the app (no Electron runtime, no node_modules). */
const appAssetName = (version) => `subzer0-app-${version}.zip`
/** A tiny json describing the app zip, so we can skip it when nothing changed. */
const appManifestName = (version) => `subzer0-app-${version}.json`
const CHECK_TTL = 10 * 60 * 1000
const DOWNLOAD_TIMEOUT = 45 * 60 * 1000

let checkCache = { at: 0, result: null }
let tokenCache
let applying = false

function explain(cause) {
  if (cause && cause.code === 'ENOENT') return 'gh CLI not found on this machine'
  const text = String((cause && (cause.stderr || cause.message)) || cause).trim()
  if (/not logged in|authenticat|credential/i.test(text)) return 'gh is not signed in to GitHub'
  if (/abort/i.test(String(cause && cause.name))) return 'download timed out'
  return text.split('\n')[0].slice(0, 140) || 'update failed'
}

function parseVersion(tag) {
  return String(tag || '').replace(/^v/i, '').trim()
}

/** Numeric comparison of dotted versions; positive when `a` is newer. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((part) => parseInt(part, 10))
  const pb = String(b).split('.').map((part) => parseInt(part, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0
    const y = Number.isFinite(pb[i]) ? pb[i] : 0
    if (x !== y) return x - y
  }
  return 0
}

async function latestRelease() {
  // The REST endpoint is the one that carries numeric asset ids, which the
  // streaming download needs; gh's `--json assets` only exposes node ids.
  const { stdout } = await run('gh', ['api', `repos/${REPO}/releases/latest`], {
    timeout: 20_000,
    windowsHide: true,
  })
  return JSON.parse(stdout)
}

/**
 * @returns {Promise<{ ok: boolean, current: string, latest?: string,
 *   available?: boolean, notes?: string|null, asset?: string|null,
 *   assetId?: number|null, assetSize?: number|null, reason?: string }>}
 */
async function checkUpdate({ force = false } = {}) {
  const current = app.getVersion() || '0.0.0'
  if (!force && checkCache.result && Date.now() - checkCache.at < CHECK_TTL) {
    return checkCache.result
  }

  try {
    const release = await latestRelease()
    const latest = parseVersion(release.tag_name)
    const asset = (release.assets ?? []).find((entry) => entry.name === assetName(latest))
    const appAsset = (release.assets ?? []).find((entry) => entry.name === appAssetName(latest))
    const appManifest = (release.assets ?? []).find((entry) => entry.name === appManifestName(latest))
    const result = {
      ok: true,
      current,
      latest,
      available: compareVersions(latest, current) > 0,
      notes: typeof release.body === 'string' && release.body.trim() ? release.body.trim() : null,
      asset: asset ? asset.name : null,
      assetId: asset ? asset.id : null,
      assetSize: asset ? asset.size : null,
      appAsset: appAsset ? appAsset.name : null,
      appAssetId: appAsset ? appAsset.id : null,
      appAssetSize: appAsset ? appAsset.size : null,
      appManifestId: appManifest ? appManifest.id : null,
    }
    checkCache = { at: Date.now(), result }
    return result
  } catch (cause) {
    return { ok: false, current, reason: explain(cause) }
  }
}

/** The gh token, so the private release asset can be fetched directly. */
async function githubToken() {
  if (tokenCache !== undefined) return tokenCache
  try {
    const { stdout } = await run('gh', ['auth', 'token'], {
      timeout: 20_000,
      windowsHide: true,
    })
    tokenCache = stdout.trim() || null
  } catch {
    tokenCache = null
  }
  return tokenCache
}

async function fileSize(target) {
  try {
    return (await fsp.stat(target)).size
  } catch {
    return 0
  }
}

function megabytes(bytes) {
  return (bytes / 1048576).toFixed(0)
}

/**
 * Stream the release asset with progress. Resumes from whatever is already on
 * disk, so a dropped connection picks up where it stopped.
 */
async function streamAsset(check, dest, report) {
  const token = await githubToken()
  if (!token) throw new Error('gh is not signed in to GitHub')

  let start = await fileSize(dest)
  if (check.assetSize && start > check.assetSize) {
    await fsp.rm(dest, { force: true })
    start = 0
  }
  if (check.assetSize && start === check.assetSize) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT)

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/octet-stream',
    'User-Agent': 'subzer0-updater',
  }
  if (start) headers.Range = `bytes=${start}-`

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${check.assetId}`,
      { headers, redirect: 'follow', signal: controller.signal }
    )
    if (response.status === 416) return
    if (!response.ok) throw new Error(`download failed (http ${response.status})`)
    if (!response.body) throw new Error('download failed (empty response)')

    const resumed = response.status === 206
    if (!resumed) start = 0
    const length = Number(response.headers.get('content-length') || 0)
    const total = resumed ? start + length : length || check.assetSize || 0

    const sink = fs.createWriteStream(dest, { flags: resumed ? 'a' : 'w' })
    const finished = new Promise((resolve, reject) => {
      sink.once('error', reject)
      sink.once('finish', resolve)
    })

    let done = start
    let lastReport = 0
    const progress = (force = false) => {
      const now = Date.now()
      if (!force && now - lastReport < 500) return
      lastReport = now
      const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0
      const suffix = total ? ` · ${megabytes(done)} of ${megabytes(total)} mb` : ''
      report(`downloading ${percent}%${suffix}`)
    }

    progress(true)
    try {
      for await (const chunk of response.body) {
        done += chunk.length
        if (!sink.write(chunk)) await once(sink, 'drain')
        progress()
      }
    } finally {
      sink.end()
      await finished
    }
    progress(true)
  } finally {
    clearTimeout(timer)
  }
}

/** API stream first; `gh release download` only if that is not possible. */
async function downloadRelease(check, dest, report) {
  try {
    await streamAsset(check, dest, report)
    if (check.assetSize && (await fileSize(dest)) !== check.assetSize) {
      throw new Error('download was incomplete')
    }
    return
  } catch (cause) {
    if (cause && cause.name === 'AbortError') throw cause
    report('Downloading subzer0 over gh…')
    await fsp.rm(dest, { force: true })
    await run(
      'gh',
      [
        'release',
        'download',
        `v${check.latest}`,
        '--repo',
        REPO,
        '--pattern',
        check.asset,
        '--output',
        dest,
        '--clobber',
      ],
      { timeout: DOWNLOAD_TIMEOUT, windowsHide: true }
    )
  }
}

/**
 * Download the newest release's setup exe, hand it the install dir and quit.
 * The installer waits for this process to exit (locked files) and relaunches.
 *
 * @param {(message: string) => void} [report] progress lines for the app
 */
async function applyUpdate(report = () => {}) {
  if (applying) return { ok: false, reason: 'An update is already running' }
  applying = true

  const check = await checkUpdate({ force: true })
  if (!check.ok) {
    applying = false
    return { ok: false, reason: check.reason }
  }
  if (!check.available) {
    applying = false
    return { ok: false, reason: `Already on the newest version (${check.current})` }
  }

  // Fast path: when the Electron runtime and node_modules have not changed, only
  // the app files (a few hundred KB) are downloaded and written in place.
  if (await tryIncremental(check, report).catch(() => false)) {
    return { ok: true }
  }

  if (!check.asset || !check.assetId) {
    applying = false
    return { ok: false, reason: `Release v${check.latest} has no Windows setup asset` }
  }

  const dir = path.join(app.getPath('temp'), `subzer0-update-${check.latest}`)
  const setup = path.join(dir, check.asset)
  try {
    await fsp.mkdir(dir, { recursive: true })

    await downloadRelease(check, setup, report)
    await fsp.access(setup)

    report('Installing — the app will restart…')
    // Only a packaged app knows its install dir; a dev run updates the
    // default location instead.
    const installDir = app.isPackaged ? path.dirname(app.getPath('exe')) : null
    const args = installDir ? ['--update', `--install-dir=${installDir}`] : ['--update']
    const child = spawn(setup, args, { detached: true, stdio: 'ignore' })
    child.unref()

    setTimeout(() => app.quit(), 900)
    return { ok: true }
  } catch (cause) {
    applying = false
    return { ok: false, reason: explain(cause) }
  }
}

/** Read the build metadata the installer drops next to package.json. */
function installedBuildInfo() {
  try {
    const file = path.join(path.dirname(app.getPath('exe')), 'resources', 'app', 'build-info.json')
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Fetch a tiny json asset (the app manifest) straight from the API. */
async function fetchManifest(assetId) {
  const token = await githubToken()
  if (!token) return null
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/releases/assets/${assetId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/octet-stream',
        'User-Agent': 'subzer0-updater',
      },
    }
  )
  if (!response.ok) return null
  return response.json()
}

/**
 * Overlay just the app files onto the existing install, then relaunch. Returns
 * true when the incremental path applies; false means a full reinstall is needed.
 */
async function tryIncremental(check, report) {
  if (!app.isPackaged) return false
  if (!check.appAssetId || !check.appManifestId || !check.appAsset) return false

  const manifest = await fetchManifest(check.appManifestId)
  if (!manifest) return false

  const current = installedBuildInfo()
  if (!current) return false
  // If the Electron runtime or node_modules changed, the small zip can't help.
  if (manifest.electronVersion && current.electronVersion !== manifest.electronVersion) return false
  if (manifest.modulesHash && current.modulesHash !== manifest.modulesHash) return false

  const dir = path.join(app.getPath('temp'), `subzer0-app-${check.latest}`)
  await fsp.mkdir(dir, { recursive: true })
  const zip = path.join(dir, check.appAsset)

  try {
    report('downloading 0%')
    await streamAsset(
      { assetId: check.appAssetId, assetSize: check.appAssetSize },
      zip,
      report
    )
    if (check.appAssetSize && (await fileSize(zip)) !== check.appAssetSize) {
      throw new Error('app download was incomplete')
    }

    report('Installing — the app will restart…')
    const appDir = path.join(path.dirname(app.getPath('exe')), 'resources', 'app')
    await run('tar', ['-xf', zip, '-C', appDir], { windowsHide: true })
    await fsp.rm(zip, { force: true })

    // Relaunch after this process has fully exited (single-instance lock).
    const exe = app.getPath('exe')
    const script = `Start-Sleep -Milliseconds 1500; Start-Process -FilePath '${exe.replace(/'/g, "''")}'`
    spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { detached: true, stdio: 'ignore' }
    ).unref()
    setTimeout(() => app.quit(), 700)
    return true
  } catch (cause) {
    await fsp.rm(zip, { force: true }).catch(() => {})
    return false
  }
}

module.exports = { checkUpdate, applyUpdate }
