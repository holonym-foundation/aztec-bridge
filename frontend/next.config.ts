import type { NextConfig } from 'next'
import webpack from 'webpack'
import path from 'path'

const nextConfig: NextConfig = {
  // bb.js lives in the workspace-root node_modules/.pnpm (not under frontend/),
  // so the lambda needs the monorepo as its tracing root for Vercel to copy
  // files that resolve above this Next project.
  outputFileTracingRoot: path.join(__dirname, '..'),
  // NOTE: COOP/COEP headers were removed because 'same-origin' COOP blocks
  // the WaaP/Silk iframe (waap.xyz) from communicating via postMessage,
  // breaking L1 wallet connections entirely. SharedArrayBuffer (needed by
  // Barretenberg WASM) works on localhost without these headers. For
  // production, a different strategy is needed (e.g. service worker proxy
  // or isolating WASM in a cross-origin-isolated iframe).
  // Framing (CSP frame-ancestors) and Permissions-Policy are NOT set here —
  // they depend on the partner embed allowlist and are built per request in
  // src/proxy.ts. X-Frame-Options is gone: it has no allowlist form, so it
  // cannot coexist with partner embedding; frame-ancestors replaces it.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  // Next's NFT trace can't see the runtime readFile that loads
  // barretenberg-threads.wasm.gz. Two patterns: the first matches when bb.js
  // is installed under frontend/node_modules/.pnpm (legacy per-package
  // install); the second matches when it's hoisted to the workspace root
  // (the layout produced by `pnpm install` from the monorepo root, which
  // is what CI does).
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/.pnpm/@aztec+bb.js*/node_modules/@aztec/bb.js/dest/**/*.wasm.gz',
      '../node_modules/.pnpm/@aztec+bb.js*/node_modules/@aztec/bb.js/dest/**/*.wasm.gz',
    ],
  },
  // Keep @aztec/bb.js as external on the server so the WASM file resolves
  // from node_modules instead of being broken by webpack bundling.
  transpilePackages: ['@human.tech/clean.sdk', '@human.tech/shield-embed'],
  serverExternalPackages: [
    '@aztec/bb.js',
    '@aztec/aztec.js',
    '@aztec/foundation',
    '@aztec/stdlib',
    '@aztec/circuits.js',
    'pino',
    'pino-pretty',
  ],
  // Use webpack for polyfills compatibility
  webpack: (config, { isServer }) => {
    // Add polyfills for Node.js built-ins in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
        url: require.resolve('url'),
        assert: require.resolve('assert'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify'),
        zlib: require.resolve('browserify-zlib'),
        fs: false,
        net: false,
        tls: false,
      }

      // Provide Buffer globally
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      )

    }

    // pnpm nests @aztec/aztec.js under its dependents, so packages that import
    // its subpath exports (e.g. @aztec-foundation/aztec-standards' generated
    // Token.js -> '@aztec/aztec.js/abi') can't resolve them. serverExternalPackages
    // only externalizes the bare package, not these subpaths. Alias them to the
    // hoisted package so both the server and client bundles resolve.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@aztec/aztec.js/abi': require.resolve('@aztec/aztec.js/abi'),
      '@aztec/aztec.js/contracts': require.resolve('@aztec/aztec.js/contracts'),
      '@aztec/aztec.js/fields': require.resolve('@aztec/aztec.js/fields'),
    }

    return config
  },
}

export default nextConfig
