import * as Sentry from '@sentry/node'

/* =========================================================================
   Shared error monitoring for the serverless functions. INERT until
   SENTRY_DSN is set in the Vercel environment — no DSN → no init, no
   network, zero behavior change locally and in preview. Errors only (no
   performance tracing) to keep cold starts + cost down.

   Vercel does NOT turn files prefixed with "_" into routes, so this is a
   shared helper, not an endpoint.

   NOTE: the Stripe functions (create-checkout-session.js, webhook.js) are
   deliberately NOT wrapped — they must stay byte-identical to main
   (guardrail, verified by git diff). They already fail CLOSED with
   console.error, which Vercel captures in the function logs.
   ========================================================================= */

const DSN = process.env.SENTRY_DSN
let ready = false
if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0,
  })
  ready = true
}

// Wrap a Vercel function handler: capture any UNEXPECTED throw, flush it to
// Sentry, then rethrow so the platform's error response is unchanged. When no
// DSN is configured this is an identity passthrough — the original handler,
// untouched.
export function withSentry(handler) {
  if (!ready) return handler
  return async function (req, res) {
    try {
      return await handler(req, res)
    } catch (err) {
      Sentry.captureException(err)
      await Sentry.flush(2000).catch(() => {})
      throw err
    }
  }
}

// For capturing a HANDLED error the function chose to swallow, without
// changing its response. No-op without a DSN.
export function captureError(err, context) {
  if (!ready) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

export { Sentry }
