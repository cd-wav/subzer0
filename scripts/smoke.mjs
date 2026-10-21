/**
 * End-to-end check of the OpenCode bridge, without Electron.
 *
 *   node scripts/smoke.mjs
 *
 * Creates a session in sandbox/app, asks for one tiny file, waits for the
 * agent to go idle, then prints what it said and what it wrote.
 */

import { createRequire } from 'node:module'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const oc = require('../electron/opencode.js')
const { ensureSandbox, APP_DIR } = require('../electron/sandbox.js')

const TIMEOUT_MS = 180_000

await ensureSandbox()
const target = APP_DIR

console.log('[smoke] cli       :', oc.findCli())
console.log('[smoke] directory :', target)

const info = await oc.serverInfo()
console.log('[smoke] server    :', info.version, info.urls?.join(', '))

const session = await oc.createSession({ directory: target, title: 'smoke test' })
console.log('[smoke] session   :', session.id)

// The location only exists once a session registered it, so this must come
// after session creation.
const model = await oc.defaultModel(target)
console.log(
  '[smoke] model     :',
  model ? `${model.providerID}/${model.id}` : '(none — check your OpenCode model config)'
)

const done = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timed out waiting for the agent to finish')), TIMEOUT_MS)
  void oc
    .subscribe((event) => {
      if (event?.data?.sessionID !== session.id) return
      if (
        event.type === 'session.execution.succeeded' ||
        event.type === 'session.execution.failed' ||
        event.type === 'session.execution.interrupted' ||
        event.type === 'session.idle'
      ) {
        clearTimeout(timer)
        resolve()
      }
      if (event.type === 'permission.asked') {
        console.log('[smoke] permission asked:', event.data.action, event.data.resources)
        oc.replyPermission(session.id, event.data.id, 'reject').catch(() => {})
      }
    })
    .catch(reject)
})

await oc.prompt(
  session.id,
  'Create a file named smoke.txt containing exactly the text: bridge ok\nThen reply with one short sentence.'
)
console.log('[smoke] prompt sent, waiting for the agent…')

await done

const messages = await oc.listMessages(session.id)
for (const message of messages) {
  if (message.type === 'assistant') {
    for (const part of message.content ?? []) {
      if (part.type === 'text') console.log('[smoke] assistant :', part.text.trim())
      if (part.type === 'tool') console.log('[smoke] tool      :', part.name, part.state?.status)
    }
  }
}

const file = path.join(target, 'smoke.txt')
if (!existsSync(file)) {
  console.error('[smoke] FAIL: agent did not create smoke.txt')
  process.exit(1)
}
console.log('[smoke] wrote     :', JSON.stringify(readFileSync(file, 'utf8').trim()))
rmSync(file, { force: true })

const final = await oc.getSession(session.id)
console.log('[smoke] tokens    :', final.tokens)
console.log('[smoke] PASS')
process.exit(0)
