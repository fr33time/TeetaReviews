import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The built SPA is served by the Express app in production, so the output
// lands in web/dist and the server mounts it as static. In development Vite
// serves the UI and proxies /api through to the Express process.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
})
