/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { addCsp } from './scripts/lib/csp.ts'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// The shipped artifact is one HTML file named after the app, not index.html, with a
// Content-Security-Policy that blocks every network request. Runs after vite-plugin-singlefile
// has inlined the script and stylesheet; the build fails if anything was left outside the file.
function shipHtml(fileName: string): Plugin {
  return {
    name: 'ship-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') return
      html.fileName = fileName
      html.source = addCsp(String(html.source))
      const others = Object.keys(bundle).filter((name) => name !== 'index.html')
      if (others.length > 0) {
        this.error(`The build must be one HTML file, but it also writes: ${others.join(', ')}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), shipHtml('pad-log-viewer.html')],
  // Nothing is copied beside the HTML: every asset is inlined.
  publicDir: false,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
  },
})
