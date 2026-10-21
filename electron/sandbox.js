'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SANDBOX = path.join(ROOT, 'sandbox')
const APP_DIR = path.join(SANDBOX, 'app')
const SEED = path.join(__dirname, 'seed')
const SETTINGS = path.join(SANDBOX, '.conv.json')

async function ensureSandbox() {
  await fsp.mkdir(SANDBOX, { recursive: true })

  for (const name of ['AGENTS.md', 'opencode.json']) {
    const target = path.join(SANDBOX, name)
    if (!fs.existsSync(target)) {
      await fsp.copyFile(path.join(SEED, name), target)
    }
  }

  await fsp.mkdir(APP_DIR, { recursive: true })
  const existing = await fsp.readdir(APP_DIR).catch(() => [])
  if (existing.length === 0) {
    await fsp.cp(path.join(SEED, 'app'), APP_DIR, { recursive: true })
  }
}

async function resetApp() {
  const entries = await fsp.readdir(APP_DIR).catch(() => [])
  await Promise.all(
    entries.map((entry) => fsp.rm(path.join(APP_DIR, entry), { recursive: true, force: true }))
  )
  await fsp.cp(path.join(SEED, 'app'), APP_DIR, { recursive: true })
}

module.exports = { ROOT, SANDBOX, APP_DIR, SEED, SETTINGS, ensureSandbox, resetApp }
