// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import vue from '@astrojs/vue'
import svelte from '@astrojs/svelte'
import lit from '@astrojs/lit'

// https://astro.build/config
export default defineConfig({
  integrations: [react(), vue(), svelte(), lit()],
  vite: {
    optimizeDeps: {
      exclude: ['unnecessary-package'],
    },
    logLevel: 'info',
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  },

  output: 'static',
})
