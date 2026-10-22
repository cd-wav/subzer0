'use strict'

/**
 * Bridge to the local OpenCode service.
 *
 * Pure Node (no Electron imports) so it can be smoke-tested directly:
 *   node scripts/smoke.mjs
 *
 * The heavy lifting (discovery, spawning the background service, auth headers)
 * is delegated to @opencode/client's Service helper.
 */

const fs = require('node:fs')
const path = require('node:path')

let servicePromise = null
let clientPromise = null

/** Locate an opencode executable without assuming it is on PATH. */
function findCli() {
  const explicit = process.env.OPENCODE_CLI
  if (explicit && fs.existsSync(explicit)) return explicit

  const candidates = []

  // 1. OpenCode Desktop bundles a CLI here: <appdata>/ai.opencode.desktop/cli/<version>/opencode-cli.exe
  const cliRoot = path.join(process.env.APPDATA || '', 'ai.opencode.desktop', 'cli')
  if (fs.existsSync(cliRoot)) {
    const versions = fs.readdirSync(cliRoot).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true })
    )
    for (const version of versions) {
      for (const exe of ['opencode-cli.exe', 'opencode.exe', 'opencode']) {
        const full = path.join(cliRoot, version, exe)
        if (fs.existsSync(full)) candidates.push(full)
      }
    }
  }

  // 2. Anything named opencode on PATH
  const pathExt = (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean)
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const base of ['opencode', 'opencode-cli']) {
      for (const ext of ['', ...pathExt, ...pathExt.map((e) => e.toLowerCase())]) {
        const full = path.join(dir, base + ext)
        if (fs.existsSync(full)) candidates.push(full)
      }
    }
  }

  return candidates[0] || 'opencode'
}

async function getEndpoint() {
  if (!servicePromise) {
    servicePromise = (async () => {
      const { Service } = await import('@opencode/client/service')
      // `--port 0` lets a freshly spawned service pick any free port. Without
      // it a spawn dies on the configured port if something else holds it.
      return Service.ensure({ command: [findCli(), 'serve', '--service', '--port', '0'] })
    })().catch((error) => {
      servicePromise = null
      throw error
    })
  }
  return servicePromise
}

/**
 * Start / discover the background service without waiting for a chat message.
 * Called at boot so a closed OpenCode is already running by the time the user
 * types something.
 */
async function warmup() {
  return getEndpoint()
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ OpenCode }, { Service }] = await Promise.all([
        import('@opencode/client'),
        import('@opencode/client/service'),
      ])
      const endpoint = await getEndpoint()
      return OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) })
    })().catch((error) => {
      clientPromise = null
      throw error
    })
  }
  return clientPromise
}

async function serverInfo() {
  const client = await getClient()
  return client.server.info()
}

async function defaultModel(directory) {
  const client = await getClient()
  const result = await client.model.default({ location: { directory } })
  return result.data
}

async function createSession({ directory, title, model }) {
  const client = await getClient()
  return client.session.create({
    location: { directory },
    title,
    ...(model ? { model } : {}),
  })
}

async function getSession(sessionID) {
  const client = await getClient()
  return client.session.get({ sessionID })
}

/** Give a conversation a real name; the first message is the best title. */
async function renameSession(sessionID, title) {
  const client = await getClient()
  return client.session.update({ sessionID, title })
}

/** Delete a conversation for good. */
async function removeSession(sessionID) {
  const client = await getClient()
  return client.session.remove({ sessionID })
}

/** Recent conversations in this folder, newest first. */
async function listSessions(directory, limit = 30) {
  const client = await getClient()
  const result = await client.session.list({
    location: { directory },
    limit,
    order: 'desc',
  })
  const data = Array.isArray(result) ? result : result?.data ?? []
  return data.map((session) => ({
    id: session.id,
    // Sessions we create are titled "subzer0" until their first message.
    title: !session.title || session.title === 'subzer0' ? 'New chat' : session.title,
    created: session.time?.created ?? 0,
    updated: session.time?.updated ?? session.time?.created ?? 0,
    cost: session.cost ?? 0,
  }))
}

/**
 * Every enabled model the local service knows about, flattened to what the
 * app's settings panel needs.
 *
 * Three plans come back:
 *   free  — every cost tier is zero
 *   go    — served through the OpenCode Go provider (subscription)
 *   paid  — metered per token from the OpenCode balance
 *
 * A model that exists in several providers is kept once, preferring the free
 * entry, then Go (cheapest), then metered.
 */
async function listModels() {
  const client = await getClient()
  const result = await client.model.list()
  const models = Array.isArray(result) ? result : result?.data ?? []

  const rank = { free: 0, go: 1, paid: 2 }
  const byID = new Map()

  for (const model of models) {
    if (model.enabled === false) continue

    const tiers = Array.isArray(model.cost) && model.cost.length ? model.cost : [{}]
    const free = tiers.every(
      (cost) => !cost.input && !cost.output && !cost.cache?.read && !cost.cache?.write
    )
    const plan = free ? 'free' : model.providerID === 'opencode-go' ? 'go' : 'paid'
    const price = free
      ? { input: 0, output: 0 }
      : {
          input: Math.min(...tiers.map((tier) => tier.input ?? 0)) || 0,
          output: Math.min(...tiers.map((tier) => tier.output ?? 0)) || 0,
        }

    const id = model.modelID ?? model.id
    const entry = {
      providerID: model.providerID,
      id,
      name: model.name,
      family: model.family ?? null,
      plan,
      price,
      context: model.limit?.context ?? 0,
      output: model.limit?.output ?? 0,
      status: model.status ?? 'active',
      variants: (model.variants ?? []).map((variant) => variant.id).filter((v) => v !== 'default'),
      reasoning: Boolean(model.compatibility?.reasoningField) || (model.variants ?? []).length > 0,
    }

    const existing = byID.get(id)
    if (!existing || rank[plan] < rank[existing.plan]) byID.set(id, entry)
  }

  return [...byID.values()].sort(
    (a, b) => rank[a.plan] - rank[b.plan] || a.name.localeCompare(b.name)
  )
}

/** Switch the live session's model without losing its history. */
async function switchModel(sessionID, model) {
  const client = await getClient()
  return client.session.switchModel({ sessionID, model })
}

/** Summarise old turns so the next request stays small. */
async function compactSession(sessionID) {
  const client = await getClient()
  return client.session.compact({ sessionID })
}

async function listMessages(sessionID) {
  const client = await getClient()
  const result = await client.message.list({ sessionID, order: 'asc', limit: 200 })
  return result.data
}

async function prompt(sessionID, text) {
  const client = await getClient()
  return client.session.prompt({ sessionID, text })
}

async function interrupt(sessionID) {
  const client = await getClient()
  return client.session.interrupt({ sessionID })
}

async function replyPermission(sessionID, requestID, reply) {
  const client = await getClient()
  return client.session.permission.reply({ sessionID, requestID, reply })
}

/**
 * Subscribe to the server event stream. `onEvent` receives every event; the
 * caller filters. Resolves only when the stream ends.
 */
async function subscribe(onEvent, { signal } = {}) {
  const client = await getClient()
  for await (const event of client.event.subscribe(signal ? { signal } : undefined)) {
    onEvent(event)
  }
}

module.exports = {
  findCli,
  getEndpoint,
  getClient,
  warmup,
  serverInfo,
  defaultModel,
  listModels,
  createSession,
  getSession,
  listSessions,
  renameSession,
  removeSession,
  switchModel,
  compactSession,
  listMessages,
  prompt,
  interrupt,
  replyPermission,
  subscribe,
}
