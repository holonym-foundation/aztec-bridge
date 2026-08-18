import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/protocol.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    // Script-tag build. Copied to frontend/public/embed.js so partners load it
    // from the Shield origin — which is also how the loader discovers the app
    // URL without being told.
    entry: { embed: 'src/global.ts' },
    format: ['iife'],
    globalName: 'Shield',
    outDir: 'dist/iife',
    minify: true,
    sourcemap: false,
    clean: false,
  },
])
