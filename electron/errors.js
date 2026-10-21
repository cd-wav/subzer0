'use strict'

/**
 * Turns OpenCode's structured errors into something a person can act on.
 *
 * The three cases that actually matter:
 *   - the free tier ran out of usage  -> pick OpenCode Go or wait
 *   - OpenCode Go is not on this plan -> subscribe, or stay on free models
 *   - anything else                   -> show it raw
 *
 * Pure JS, no Electron imports, so it can be unit-tested directly.
 */

const LIMIT = /rate.?limit|usage limit|quota|too many requests|limit reached|out of credits|insufficient|exhaust/i
const PLAN = /subscription|not subscribed|upgrade|plan required|payment required|billing|entitle/i
const AUTH = /unauthor|invalid.*(token|key|credential)|sign in|log ?in/i

function errorText(raw) {
  const error = typeof raw === 'string' ? { message: raw } : raw && typeof raw === 'object' ? raw : {}
  return {
    status: typeof error.status === 'number' ? error.status : null,
    type: typeof error.type === 'string' ? error.type : '',
    retryAfterMs: typeof error.retryAfterMs === 'number' ? error.retryAfterMs : null,
    message: [error.message, error.response?.body].filter(Boolean).join(' \n '),
  }
}

function explainError(raw, options = {}) {
  const { status, type, retryAfterMs, message } = errorText(raw)
  const haystack = `${type} ${message}`
  const label = options.model?.name ? `“${options.model.name}”` : 'this model'
  const isGo = options.model?.plan === 'go'

  if (status === 402 || (PLAN.test(haystack) && !LIMIT.test(haystack))) {
    return {
      kind: 'plan',
      message: isGo
        ? `OpenCode Go is not active on this account, so ${label} cannot run. Subscribe at opencode.ai/console, or pick a free model.`
        : `This model needs an active OpenCode plan or credits. Check your account at opencode.ai/console, or pick a free model.`,
    }
  }

  if (status === 429 || LIMIT.test(haystack)) {
    const wait = retryAfterMs
      ? ` It should reset in about ${Math.max(1, Math.ceil(retryAfterMs / 1000))}s.`
      : ''
    return isGo
      ? {
          kind: 'limit',
          message: `OpenCode Go usage limit reached on ${label}.${wait} Switch model or wait for your Go allowance to reset.`,
        }
      : {
          kind: 'limit',
          message: `Free usage limit reached on ${label}.${wait} Switch to an OpenCode Go model in Settings, or wait for the free limit to reset.`,
        }
  }

  if (status === 401 || AUTH.test(haystack)) {
    return {
      kind: 'auth',
      message: 'OpenCode rejected the request (not signed in). Open OpenCode and sign in again, then retry.',
    }
  }

  return {
    kind: 'error',
    message: message || String(raw ?? 'Something went wrong.'),
  }
}

module.exports = { explainError }
