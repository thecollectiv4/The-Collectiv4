import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    // bind every interface: localhost resolves to ::1 AND 127.0.0.1 on macOS,
    // and binding only one of them (node picks ::1) refuses the other —
    // "the link doesn't work" depending on which the browser tries first.
    host: true,
    port: 5173
  }
})
