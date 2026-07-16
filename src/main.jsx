import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'

/* Error monitoring — INERT until VITE_SENTRY_DSN is set in the environment
   (Vercel). No DSN → no init, no network, zero behavior change locally and in
   preview. Errors only; no performance tracing (tracesSampleRate 0) to keep
   it light and free. Unhandled errors + promise rejections are captured by
   the SDK's default global handlers once initialized. */
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })
}

/* A crash anywhere in the tree shows a calm cosmos fallback instead of a
   white screen (the v2 sky-canvas crash that took the whole app down is
   exactly this class of failure — decoration, now Atmosphere.jsx, must
   never take the page with it). When the DSN is set, it's also reported.
   Inline styles + system tokens so the fallback can't itself depend on
   anything that might be the thing that broke. */
function CrashFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px', textAlign: 'center', background: '#0A0A0D', color: '#F2EEE6' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '34px', letterSpacing: '.02em' }}>SOMETHING BROKE</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#83838F', letterSpacing: '.06em', lineHeight: 1.6, maxWidth: '320px' }}>A part of the universe hit an error. Reloading usually fixes it.</div>
      <button onClick={() => window.location.assign('/')} style={{ marginTop: '4px', background: '#F2EEE6', color: '#0A0A0D', border: 'none', borderRadius: '100px', padding: '11px 22px', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer' }}>Reload</button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
// cache bust 1777760686
