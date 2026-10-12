/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The shipped artifact is a single HTML file named after the app, not index.html.
function renameHtml(fileName: string): Plugin {
  return {
    name: 'rename-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      if (html) {
        html.fileName = fileName
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), renameHtml('pad-log-viewer.html')],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
  },
})
