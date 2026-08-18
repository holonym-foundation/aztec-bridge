# Audit Report — Partner Embed Feature

**Date:** 2026-08-14
**Branch:** `testnet` (uncommitted working tree)
**Scope:** The embeddable-widget work — loader package, framed-app runtime, framing headers, and the partner-facing docs

---

## Scope

| Layer | Files |
|-------|-------|
| **Loader (npm + script tag)** | `packages/embed-sdk/src/{index,global,protocol}.ts`, `tsup.config.ts`, `scripts/copy-loader.mjs` |
| **Framed-app runtime** | `frontend/src/lib/embed/{mode,child,protocol,storageAccess}.ts`, `frontend/src/components/EmbedBridge.tsx` |
| **Headers / policy** | `frontend/src/proxy.ts`, `frontend/src/lib/embedAllowlist.ts`, `frontend/next.config.ts`, `frontend/src/config/env.config.ts` |
| **App integration** | `ClientLayout.tsx`, `RootStyle.tsx`, `providers.tsx`, `utils/support.ts`, `hooks/useL1Operations.ts`, `hooks/useL2Operations.ts`, `app/page.tsx` |
| **Docs** | `frontend/src/app/docs/developers/page.tsx` (Embed Shield section) |

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| High | 3 | fixed |
| Medium | 7 | fixed |
| Low / verify | 7 | 5 fixed, 2 verified |

**Resolution (2026-08-14).** Every finding is addressed; see the per-finding
**Resolved** notes below. Verified with `tsc --noEmit` (frontend + loader),
`vitest run` (134 tests, 8 files — including new coverage for the route guard,
amount parsing, the allowlist, and the loader's busy/a11y/inline behaviour), a
full `next build`, and `pnpm design-lint` (enforced rules clean).

Two findings turned out to be materially different from the report:

- **L-1 was a real deploy break, not a "confirm".** CI (`vercel-deploy-bridge.yml`)
  builds `packages/sdk` and then `frontend` directly — it never runs the root
  `turbo build`, so `packages/embed-sdk` never built and the gitignored
  `frontend/public/embed.js` would have 404'd for every partner.
- **L-2 listed three sites; only two existed.** `embedAllowlist.ts` never
  mentioned `middleware.ts`.

---

## Verified correct

These were checked against source rather than assumed:

- **Framing default is a no-op change.** With `EMBED_ALLOWED_ORIGINS` unset, `getFrameAncestors()` returns `'self'`, exactly reproducing the removed `X-Frame-Options: SAMEORIGIN`. Non-origin entries are dropped rather than passed into the directive (`embedAllowlist.ts:15-21`).
- **postMessage hygiene.** Neither half ever targets `'*'`. Both check `event.origin` *and* `event.source` before accepting (`child.ts:59-60`, `index.ts:88-89`), and inbound messages are re-narrowed by shape rather than asserted into the union (`child.ts:43`).
- **Permissions-Policy.** Structured-header syntax is valid, and the allowlist correctly names the nested wallet origins (down the frame tree) rather than the partner origins (up it).
- **Docs claim on backup recovery.** "Its key derives from Shield's own origin" holds: `packages/sdk/src/client.ts:59` defaults the key-derivation domain to `window.location.origin`, which inside the iframe is Shield's origin, not the partner's.
- **No hydration mismatch from `useIsEmbedded()`.** It is a synchronous cache read, not a hook, but `app/layout.tsx` gates the whole tree on `mounted`, so `ClientLayout`/`RootStyle` never render during SSR.

---

## High

### H-1 — `busy` guard can deadlock the modal permanently

**File:** `packages/embed-sdk/src/index.ts:93-94`

`busy` is set on `tx:submitted` and cleared only on `bridge:success` or `error`. Grepping every `emitToParent` call site in `frontend/src`, **`error` is never emitted anywhere in the app.** Any L1 bridge that fails, reverts, or is abandoned after the transaction reaches the mempool leaves the modal permanently undismissable — Esc and backdrop click are both routed through `dismiss()`, which no-ops while `busy`.

This is compounded by the docs, which explicitly tell partners not to build their own dismissal on top of it.

**Fix:** emit `error` from the failure branches in `useL1Operations`/`useL2Operations`, and add a `busy` timeout as a backstop.

**Resolved.** Both hooks now emit `error` from every failure branch, carrying the same classification tag Datadog already uses (`congestion`, `contract_revert`, `artifact_not_found`, `sync_timeout`, `claim_failed`, `already_completed`, `backup_failed`, `unknown`) and a user-safe message rather than the raw revert string. A `mutation.onError` backstop covers throws the SDK never emitted an event for, de-duped through an `embedErrorSent` ref so a partner never sees two `error`s for one failure. The loader adds `setBusy()` with a chain-aware timeout — 15 min for L1, 90 min for L2 (an L2 withdrawal waits on L1 proving) — so the lock cannot outlive a frame that dies without reporting.

### H-2 — `navigate` guard misses the backslash form

**File:** `frontend/src/components/EmbedBridge.tsx:38`

```ts
if (message.route.startsWith('/') && !message.route.startsWith('//'))
```

`/\evil.com` passes this check, and URL parsing normalizes `/\` to `//` — the exact escape the comment above it says it prevents. The host is allowlisted, so this is defense-in-depth rather than an open door, but the guard does not do what it claims.

**Fix:** resolve with `new URL(route, location.origin)` and require the origin to match.

**Resolved.** Extracted as `resolveEmbedRoute(route, origin)` in `mode.ts` and unit-tested against `//evil.com`, `/\evil.com`, `\/evil.com`, absolute foreign origins, and `javascript:`/`data:` schemes.

### H-3 — `tx:submitted` is L1-only, so withdrawals are unprotected

**Files:** `frontend/src/hooks/useL1Operations.ts:591`, `frontend/src/hooks/useL2Operations.ts:538`

The L1 path emits `tx:submitted`; the L2 withdrawal path emits `bridge:success` on completion but never emits `tx:submitted`, so `busy` is never set. A withdrawal in flight can be dismissed by Esc or a backdrop click — precisely the case the `busy` guard exists for.

**Resolved.** `BURN_SENT` now emits `tx:submitted` with `chain: 'l2'`, mirroring `DEPOSIT_SENT` on the L1 path.

---

## Medium

### M-1 — Session restore skips the framed check

**File:** `frontend/src/lib/embed/mode.ts:61-68`

`readFromUrl()` deliberately requires both signals (`embed=1` *and* `window.self !== window.top`, `mode.ts:44`). `readFromSession()` rehydrates `isEmbedded: true` without re-testing the framing signal, so a restored entry can put a top-level tab into widget chrome — the failure the two-signal rule was written to prevent. Storage partitioning makes this unlikely in current browsers, but the check is one line.

**Resolved.** `readFromSession()` re-tests `window.self !== window.top` and re-validates the restored entry field by field rather than trusting the parsed JSON.

### M-2 — Embed defaults re-apply pre-reset bridge state

**File:** `frontend/src/app/page.tsx` (mount effect)

The effect calls `resetBridgeStore()` and then `setBridgeConfig({ ...bridgeConfig, amount })`, but `bridgeConfig` was captured at render time — *before* the reset. The inline comment claims it is the post-reset snapshot; it is not. In embed mode, navigating away from `/` and back restores the previous `from`/`to`/`amount`, undoing the reset.

**Fix:** read `useBridgeStore.getState()` at call time, or add a merge-only amount action.

**Resolved.** Added `setAmount` to the bridge store (merge-only, alongside `updateToken`) and used it here. `useBridgeStore` is a `useShallow` selector hook rather than the raw store, so it has no `getState()` — the store action was the available fix.

### M-3 — Amount validation is too loose

**File:** `frontend/src/app/page.tsx` (mount effect)

`!isNaN(Number(defaults.amount))` accepts `-5`, `Infinity`, and `0x10`. The value comes from a URL parameter.

**Fix:** require a positive, finite decimal.

**Resolved.** `parseEmbedAmount()` requires `/^\d*\.?\d+$/` and a finite value `> 0`, applied at the point the embed context is parsed so both the URL and the restored-session path are covered. Unit-tested against `-5`, `Infinity`, `0x10`, `1e3`, `0`, and whitespace.

### M-4 — Docs advertise an event that is never emitted

**File:** `frontend/src/app/docs/developers/page.tsx`

The events table lists `error` (`code`, `message`), and the warning callout tells partners to wait for `bridge:success` or `error`. Nothing emits `error`. Same root cause as H-1 — fix the implementation or remove the documented event.

**Resolved** by fixing the implementation (H-1). The callout now also states that every failure emits `error` and that the lock self-releases on the timeout, so the documented contract matches the code.

### M-5 — `protocol` version is never validated

**File:** `packages/embed-sdk/src/protocol.ts:44`

`isEmbedEnvelope` checks `channel` and `type` only. `EMBED_PROTOCOL_VERSION` is carried on every message and read by nobody, so a future v2 loader against a v1 app half-works silently instead of failing cleanly.

**Resolved.** `isEmbedEnvelope` now requires `protocol === EMBED_PROTOCOL_VERSION`. Both halves import the check from the same module, so they cannot disagree.

### M-6 — Modal accessibility gaps

**File:** `packages/embed-sdk/src/index.ts:133-162`

The overlay sets `role="dialog"` and `aria-modal="true"` but there is no focus trap, no `inert`/`aria-hidden` on host content, no body scroll lock, and no `aria-labelledby`. Tab moves focus behind the overlay, and the host page scrolls under it.

**Resolved.** The overlay is wrapped in two focus sentinels that hand focus back to the frame — a conventional trap cannot enumerate focusables inside a cross-origin iframe. Host content is marked `inert` (tagged `data-shield-inert` so only what this widget set is unset), and `body.overflow` is locked and restored on close. `aria-labelledby` was not added: the overlay already carries an `aria-label`, and there is no same-origin title node to point at.

### M-7 — Script-tag loader can throw at module top level

**Files:** `packages/embed-sdk/src/global.ts:38`, `index.ts:166`

`data-target` selects inline mode, which mounts immediately during module evaluation. If the target element is not in the DOM yet — a `<script>` in `<head>`, a plausible integration — `mountInline()` throws, killing the IIFE and the `Shield` global.

**Fix:** defer to `DOMContentLoaded`, or fail soft with a console error.

**Resolved** — both. `open()` defers the inline mount when `document.readyState === 'loading'` (cancelled by `destroy()`), and `mountInline()` logs and returns instead of throwing when the target is still absent.

---

## Low / verify

### L-1 — `frontend/public/embed.js` is gitignored and build-generated

`.gitignore` excludes it; only `packages/embed-sdk`'s build (`scripts/copy-loader.mjs`) produces it, and `frontend`'s own `build` script does not. `turbo.json`'s `build.dependsOn: ["^build"]` covers a root `turbo build`. Confirm the deploy actually runs the root build — otherwise every partner 404s on the loader URL.

**Resolved — and this was live, not hypothetical.** `.github/workflows/vercel-deploy-bridge.yml` builds `packages/sdk` and then runs `pnpm build` in `./frontend`; no job runs the root `turbo build`, so the loader would never have been generated. Fixed at the source rather than in CI: `frontend` now has a `prebuild` that builds `@human.tech/shield-embed`, so any path that builds the frontend also publishes `public/embed.js`. `predev` does the same. Verified by deleting `public/embed.js` and running `pnpm build`.

### L-2 — Stale `middleware.ts` references

`frontend/.env.example`, `frontend/src/lib/embed/storageAccess.ts:22`, and the `embedAllowlist.ts` header all point at `middleware.ts`. Under Next 16 the file is `frontend/src/proxy.ts`.

**Resolved.** Two of the three existed and now say `src/proxy.ts`; `embedAllowlist.ts` never mentioned middleware (`env.config.ts` already said `src/proxy.ts`). A repo-wide grep confirms no `middleware` reference remains outside `zustand/middleware` imports.

### L-3 — Storage Access request may lose transient activation

**File:** `frontend/src/lib/embed/storageAccess.ts:39-42`

The gesture handler awaits `hasStorageAccess()` before calling `requestStorageAccess()`. Stricter engines may have consumed transient activation by then. Call `requestStorageAccess()` directly inside the gesture and use `hasStorageAccess()` as a pre-check outside it. Separately, the two `{ once: true }` listeners are independent — one firing leaves the other registered until the returned cleanup runs.

**Resolved.** `requestStorageAccess()` is now the first call in the gesture, with no `await` before it; `hasStorageAccess()` became an exported pre-check that the gesture hook runs outside the gesture, so an already-granted user is never prompted. `{ once: true }` is gone — the handler removes both listeners itself.

### L-4 — proxy matcher lacks a path boundary

**File:** `frontend/src/proxy.ts:26`

`(?!api|_next/static|_next/image|favicon.ico)` matches on prefix, so a route like `/apidocs` would also be excluded from the framing headers. `api/` is more precise. Harmless today.

**Resolved.** Matcher is now `/((?!api/|_next/static/|_next/image/|favicon.ico).*)`. Verified against the compiled regex in `.next/server/functions-config-manifest.json`: `/apidocs` and `/embed.js` match, `/api/faucet`, `/_next/static/*`, `/_next/image/*` and `/favicon.ico` do not.

### L-5 — Verify the env-at-runtime assumption

`next.config.ts`'s new comment justifies moving the headers out of `headers()` because the config would bake the allowlist into the build. If `proxy.ts` resolves to the Edge runtime, `process.env` is inlined at build time there too, and the stated benefit does not exist. Confirm the Node runtime, or drop the rationale.

**Verified — the rationale holds.** Next 16 pins the proxy to Node: `get-page-static-info.js` errors with "Proxy always runs on Node.js runtime" if a `runtime` segment config is present (so it must NOT be set explicitly), and the emitted `functions-config-manifest.json` records `"/_middleware": {"runtime":"nodejs"}`. The comment in `proxy.ts` now states this explicitly.

### L-6 — Embed chrome without a working channel

**File:** `frontend/src/lib/embed/mode.ts:46-58`

A hand-written iframe with `embed=1` but a missing or invalid `parentOrigin` yields a chrome-stripped widget in which every `emitToParent` is silently dropped. Consider requiring `parentOrigin` for `isEmbedded`, or logging once.

**Resolved** by logging once. Requiring `parentOrigin` was rejected: it would flip a chrome-stripped widget back to full app chrome inside a frame, which is a worse failure than a silent channel.

### L-7 — Escape is forwarded unconditionally

**File:** `frontend/src/components/EmbedBridge.tsx:58-61`

Esc emits `close` even when an in-app modal or drawer is open, so one keypress both closes the internal overlay and requests widget dismissal.

**Resolved — coverage is now complete.** Escape is forwarded only when `hasOpenInAppOverlay()` (in `mode.ts`, unit-tested) finds nothing matching `[role="dialog"], [role="menu"], [aria-modal="true"], dialog[open], [data-esc-closes]`. Every such overlay is conditionally rendered, so a match means open.

The three pinned drawers (Activity, Notifications, Bridge steps) now take `role="dialog"` plus an `aria-label` — but **only while pinned**, not while hover-previewed. That distinction is load-bearing in both directions: pinned is genuinely a non-modal dialog (it is the state that installs the Escape and click-outside handlers), while a hover preview has no Escape handler at all, so tagging it would make merely hovering a tab swallow the widget's dismissal.

Two remaining Escape consumers — the Header mobile nav panel and the DeploymentSelector dropdown — take `data-esc-closes` instead of a role. Neither is a menu or a dialog, and `role="menu"` over plain nav links reports a menu with no items to a screen reader; the marker states the contract without lying about the semantics. Full inventory of the app’s nine Escape handlers checked against the selector: all nine now match.

---

## Suggested order

1. H-1 and H-3 together (emit `error`, emit `tx:submitted` on the L2 path, add the timeout) — they share a fix surface, and H-1 is a user-visible lockout.
2. H-2, M-1 — one-line correctness fixes.
3. M-2, M-3 — embed defaults.
4. M-4 once H-1 lands, so docs and implementation agree.
5. The rest as follow-up.

---

# Re-audit (2026-08-14, post-fix)

Independent pass over the fixed tree: every finding re-derived from source, and
the resolution claims re-run rather than taken on trust.

## Verification of the resolution claims

| Claim | Result |
|-------|--------|
| Typecheck clean (loader + frontend) | **Confirmed.** `tsc --noEmit` silent in both packages. |
| 134 tests / 8 files pass | **Confirmed.** Reproduced exactly. (`pnpm test` will not start on Node 24 — `vitest.config.ts` is loaded through `require()` and hits `ERR_REQUIRE_ESM`. Pre-existing and unrelated to this work; renaming it `.mts` fixes it. No workflow pins a Node version, so this is one runner-image bump from breaking CI.) |
| `design-lint` enforced rules clean | **Confirmed.** 64 advisory copy/state findings, none blocking. |
| L-1 — `prebuild` regenerates the loader | **Confirmed.** `public/embed.js` regenerated at build time, and pnpm 10.30.3 runs `pre` scripts by default (checked empirically, not assumed). Residual: `vercel build` uses the Vercel project's own build command and root directory, which live outside the repo — if that is ever anything but `pnpm build` in `frontend/`, the hook does not fire. Folding the embed build into `build` itself would remove the dependency on both pnpm's pre-script default and the dashboard setting. |
| L-4 — matcher boundary | **Confirmed** against the compiled regex in `.next/server/functions-config-manifest.json`. `/apidocs` matches; `/api/faucet`, `/_next/static/*`, `/_next/image/*`, `/favicon.ico` do not. |
| L-5 — proxy runs on Node | **Confirmed.** The manifest records `"/_middleware": {"runtime":"nodejs"}`. |
| L-7 — Escape inventory | **Confirmed independently.** Nine app-side Escape handlers; each has a matching selector target, and all three `role="menu"` sites plus the recovery overlay are conditionally rendered, so a match always means open. |
| H-1/H-3 — every failure path emits a terminal event | **Confirmed** by reading both hooks end to end: each `error` branch emits, the `onError` backstop covers throws with no event, and `embedErrorSent` de-dupes. |

Everything the report said was fixed, is fixed. What follows is new.

## New findings

### N-1 (Medium) — the overlay selector has no visibility check

`hasOpenInAppOverlay()` (`mode.ts:84`) matches any node in the document carrying
the selector, mounted-but-hidden ones included. Today the tree is clean, but the
invariant it rests on — "every matching node is conditionally rendered" — is
enforced only by a comment. One always-mounted overlay, or one third-party
light-DOM node with `role="dialog"`, silently kills Escape-to-close: the frame
stops forwarding, and the widget's only in-frame dismissal is gone with no
symptom to trace. Filter matches through `checkVisibility?.()` (or an
`offsetParent` test) so the guard depends on being *visible*, not on being
rendered.

### N-2 (Medium) — protocol equality makes version skew silent in both directions

`isEmbedEnvelope` now drops anything whose `protocol` is not exactly
`EMBED_PROTOCOL_VERSION` (`protocol.ts:51`). Script-tag partners auto-upgrade
because the loader is served from Shield's origin — npm consumers pinned to
`@human.tech/shield-embed@0.1.0` do not. When Shield ships protocol 2, such a
partner gets a frame that loads and then goes mute: no `ready`, no `error`,
`navigate()` ignored, and the in-frame Escape dropped, leaving backdrop click as
the only way out. Strictness here is right, silence is not. Either accept
`protocol <= EMBED_PROTOCOL_VERSION` for message types whose shape is unchanged,
or have the loader detect a channel-matching, version-mismatched message and
surface it as an `error` rather than discarding it.

### N-3 (Low) — the inert/scroll-lock fix raised the cost of a stuck `busy`

M-6 was fixed correctly, but it changes the blast radius of H-1's backstop: host
content is now `inert` and body scroll is locked, so a `busy` lock that is not
released strands the user on a page they cannot interact with at all, for 15
minutes (L1) or 90 (L2). The timeouts have to be that long to be safe, so the
escape hatch should not be the timer alone — a repeated Escape that forces
dismissal, or a `busy`-state event so the host can offer its own way out, gives
the user something to do in the meantime.

### N-4 (Low) — a blocked dismissal tells the partner nothing

`onMessage` routes a frame-sent `close` through `dismiss()` and returns without
emitting (`index.ts:117-120`). While `busy`, the user's Escape therefore produces
no host-visible signal at all, so the partner cannot explain why the widget is
refusing to close. Emit the request (or a distinct `dismiss:blocked`) so the host
can say "your bridge is still settling".

### N-5 (Low) — two widgets on one page inert each other

`setHostInert(true)` marks every `body` child that is not *this* overlay
(`index.ts:168-180`), so a second `create()`'d modal inerts the first widget's
overlay, and closing the second un-inerts it. Only bites double-mount
integrations, but the fix is a class check on the node.

### N-6 (Low) — `getStorageAccessState()` and `hasStorageAccess()` have no callers

The doc comment says callers use the state "to tell the user their local history
is site-scoped" (`storageAccess.ts:26`); no such UI exists. Either wire it into
the embedded shell or drop the promise from the comment.

### N-7 (Low) — the `error` code set is now a contract, and is undocumented

Partners will switch on `code`, and the fix introduced a real vocabulary
(`congestion`, `contract_revert`, `already_completed`, `backup_failed`,
`unknown`, …). The developer docs still list only "`code`, `message`". Publish
the set, or partners will pattern-match on `message` instead.

### N-8 (nit) — the storage-access pre-check races the first gesture

`installStorageAccessGestureHook()` starts `hasStorageAccess()` outside the
gesture, but a click landing before it resolves still fires a redundant
`requestStorageAccess()`. Harmless where an already-granted request resolves
instantly; noted only because the pre-check exists specifically to avoid it.
