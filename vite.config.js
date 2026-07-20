import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// La versión que /settings muestra sale de package.json, no de una constante
// escrita a mano en la pantalla: un número de versión que hay que acordarse
// de subir miente en cuanto alguien lo olvida, y es de lo primero que se le
// pide a un usuario cuando reporta un bug.
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    // bind every interface: localhost resolves to ::1 AND 127.0.0.1 on macOS,
    // and binding only one of them (node picks ::1) refuses the other —
    // "the link doesn't work" depending on which the browser tries first.
    host: true,
    port: 5173,
    // dev-only: let the Mac's own mDNS name (Diegos-MacBook-Air.local) and the
    // phone-on-same-wifi path through vite's host check (it 403s anything that
    // isn't literally "localhost" since the 5.4.12 security patch)
    allowedHosts: ['.local']
  }
})
