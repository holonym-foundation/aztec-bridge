import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The script-tag loader has to be served from the Shield origin: that is how it
// discovers the app URL (from its own src) and how partners get one URL to
// trust. Publishing it to frontend/public is the whole delivery mechanism, so a
// failure here must break the build rather than silently ship a stale loader.
//
// The target is gitignored, so it only exists if this ran. frontend's `prebuild`
// invokes this package's build for exactly that reason — CI deploys the frontend
// directly rather than through `turbo build`, and would otherwise 404 the loader.
const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, '..', 'dist', 'iife', 'embed.global.js')
const target = join(here, '..', '..', '..', 'frontend', 'public', 'embed.js')

await mkdir(dirname(target), { recursive: true })
await copyFile(source, target)
console.log(`[shield-embed] loader -> ${target}`)
