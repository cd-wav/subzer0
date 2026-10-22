'use strict'

/**
 * Self-update: check GitHub for a newer subzer0 release, download the setup
 * exe and run it in `--update` mode — a silent reinstall that overwrites the
 * host while leaving the user's sandbox (app files, settings, sessions)
 * untouched, then relaunches. Auth rides on the gh CLI, the same mechanism
 * `npm run publish:release` uses.
 */

const { app } = require('electron')
const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')
const fsp = require('node:fs/promises')
const path = require('node:path')

const run = promisify(execFile)

/** Private repo — asset downloads need the gh CLI's credentials. */
const REPO = 'cd-wav/conv'
/** The raw setup exe published next to the zip; the updater downloads this. */
const assetName = (version) => `subzer0-Setup-${version}-win-x64.exe`
const CHECK_TTL = 10 * 60 * 1000
const DOWNLOAD_TIMEOUT = 15 * 60 * 1000

let checkCache = { at: 0, result: null }
let applying = false

function explain(cause) {
  if (cause && cause.code === 'ENOENT') return 'gh CLI not found on this machine'
  const text = String((cause && (cause.stderr || cause.message)) || cause).trim()
  if (/not logged in|authenticat|credential/i.test(text)) return 'gh is not signed in to GitHub'
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
  const { stdout } = await run(
    'gh',
    ['release', 'view', '--repo', REPO, '--json', 'tagName,body,assets'],
    { timeout: 20_000, windowsHide: true }
  )
  return JSON.parse(stdout)
}

/**
 * @returns {Promise<{ ok: boolean, current: string, latest?: string,
 *   available?: boolean, notes?: string|null, asset?: string|null, reason?: string }>}
 */
async function checkUpdate({ force = false } = {}) {
  const current = app.getVersion() || '0.0.0'
  if (!force && checkCache.result && Date.now() - checkCache.at < CHECK_TTL) {
    return checkCache.result
  }

  try {
    const release = await latestRelease()
    const latest = parseVersion(release.tagName)
    const asset = (release.assets ?? []).find((entry) => entry.name === assetName(latest))
    const result = {
      ok: true,
      current,
      latest,
      available: compareVersions(latest, current) > 0,
      notes: typeof release.body === 'string' && release.body.trim() ? release.body.trim() : null,
      asset: asset ? asset.name : null,
    }
    checkCache = { at: Date.now(), result }
    return result
  } catch (cause) {
    return { ok: false, current, reason: explain(cause) }
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
  if (!check.asset) {
    applying = false
    return { ok: false, reason: `Release v${check.latest} has no Windows setup asset` }
  }

  const dir = path.join(app.getPath('temp'), `subzer0-update-${check.latest}`)
  try {
    await fsp.rm(dir, { recursive: true, force: true })
    await fsp.mkdir(dir, { recursive: true })

    report(`Downloading subzer0 ${check.latest}…`)
    await run(
      'gh',
      ['release', 'download', `v${check.latest}`, '--repo', REPO, '--pattern', check.asset, '--output', dir],
      { timeout: DOWNLOAD_TIMEOUT, windowsHide: true }
    )

    const setup = path.join(dir, check.asset)
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

module.exports = { checkUpdate, applyUpdate }
