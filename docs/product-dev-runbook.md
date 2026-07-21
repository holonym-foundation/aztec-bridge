# Shield — Product Dev Runbook

Operational runbook for developing, deploying, and testing the Shield app
(Aztec ↔ Ethereum private bridge, `aztec-bridge` Vercel project). Keep this current;
it captures the non-obvious gotchas that have bitten us.

Last updated: 2026-07-21.

---

## 1. Repo & branch topology

| Branch | Purpose | Deploys to |
| --- | --- | --- |
| `shady/shield-*` (feature branches) | Active UI/feature work | Vercel Preview (per-branch) |
| `testnet` | Integration + QA on Aztec testnet | Vercel **`testnet`** custom environment |
| `main` | Production (mainnet) | Vercel **Production** |

**Flow:** feature branch → PR into `testnet` → smoke-test on the testnet env →
PR `testnet` → `main` for mainnet. **Anmol reviews before anything reaches `main`/mainnet.**

Merges from a feature branch that already contains `testnet` are fast-forwards
(no conflicts). Always merge `testnet` **into** your feature branch first so the
PR diff is your changes only and can never revert what's already on `testnet`
(e.g. deployment-config commits).

---

## 2. Deployment pipeline (how it actually works)

Deploys are driven by GitHub Actions: **`.github/workflows/vercel-deploy-bridge.yml`**,
triggered on push to `main` and `testnet`.

Each job runs, in order:
1. `pnpm install` (workspace)
2. **`Build SDK`** — `pnpm build` in `packages/sdk` ← **critical step, see §3**
3. `prisma migrate deploy` (network-specific `DATABASE_URL`)
4. `pnpm build` in `frontend` (Next build)
5. `vercel pull` → `vercel build` (`--target=testnet` / `--prod`) → `vercel deploy --prebuilt`

Branch → target mapping is enforced in the workflow: `testnet` → `--target=testnet`
(a Vercel Custom Environment that **cannot touch the mainnet production domain**),
`main` → `--prod`.

**Canonical way to deploy: push the branch. Let CI do it.** CI is the only path that
is guaranteed to rebuild the SDK. Deploys appear under the shared token's user
(`calebtuttle`) regardless of who pushed — they are CI deploys, not manual.

### Environments / URLs
- **testnet:** https://aztec-bridge-env-testnet-holonym.vercel.app
- **production:** the mainnet domain (via `--prod`)
- Vercel project: `holonym/aztec-bridge` (org `team_Uql08jo75ikAKNUh2FXl1zj0`), root dir `frontend`.

---

## 3. ⚠️ The deployment-id / SDK-`dist` gotcha (read this)

**The single most common way to "break" the app: a stale `@human.tech/clean.sdk` build.**

- `@human.tech/clean.sdk` is a **workspace symlink** → `packages/sdk`. The runtime imports
  the **compiled `dist/`** (`main: ./dist/index.cjs`), not `src/`.
- The active deployment id (currently `5.0.1_2026-07-17`) and its contract addresses
  are **compiled into `dist`**. `packages/sdk/dist` is **gitignored** — it is never
  committed; it must be built.
- The frontend requests `activeDeploymentId` from `frontend/src/constants/deployments.json`.
  If the compiled SDK `dist` doesn't contain that id, the app throws at runtime:
  **`Unknown deployment: <id>`** (blank/crashed page).

**When it bites:**
- **Local dev / preview** with a stale `dist` after pulling deployment/config changes.
- **Any manual laptop `vercel deploy --prebuilt`** that skips the SDK rebuild — this
  bypasses CI's `Build SDK` step and can ship a stale `5.0.x` bundle. **Don't do manual
  prebuilt deploys** unless you rebuilt the SDK first (see below). Prefer pushing the branch.

**Fix / prevention (local):**
```bash
# after pulling any deployment-id / contract-address / SDK change:
pnpm --filter @human.tech/clean.sdk build
# verify the id the runtime will see:
grep -o "5\.0\.[0-9]_2026-07-17" packages/sdk/dist/index.cjs | sort -u
# it must include the activeDeploymentId from frontend/src/constants/deployments.json
```
Note: the version **display** (`v 5.0.1`) is driven separately by `network.aztecVersion`
in `frontend/src/constants/deployments.json` — not the deployment id. Don't rename the
deployment id to match the version; the id must match the SDK's bundled deployment list.

**Recommended hardening (not yet done):** add `"prepare": "tsup"` to `packages/sdk/package.json`
so `pnpm install` always builds `dist`. That protects local dev and every non-CI path,
and removes this whole class of failure.

---

## 4. Local development

```bash
pnpm install
pnpm --filter @human.tech/clean.sdk build   # ← see §3; do this after any SDK/deployment change
cd frontend && pnpm dev                       # next dev --webpack
```

**Pre-push gates (run before opening/updating a PR):**
```bash
cd frontend
npx tsc --noEmit          # must exit 0
pnpm build                # full prod build — catches runtime/config issues tsc can't
```
`tsc` alone is **not** sufficient — the deployment-id crash (§3) passes `tsc` and only
fails at build/runtime. Always run `pnpm build` before pushing anything that touches
config, the SDK, or deployment data.

---

## 5. Smoke test (run against the testnet env after every deploy)

**P0 — blockers, must pass:**
1. App loads, **no "Unknown deployment" crash**; version shows the expected `v X.Y.Z`.
2. Connect both wallets (Ethereum + Aztec); step rail advances.
3. **Withdraw enables on first load** (Aztec→Eth) with a valid amount — no switch→Max→switch dance.
4. Real **deposit** (Eth→Aztec): sign-toast appears → deposit confirms → claim on Aztec.
5. Real **withdraw** (Aztec→Eth) completes.
6. **Fuel-juice top-up** (buy on L1 → bridge to L2) succeeds.
7. No page scroll on `/`, `/progress`, and the withdraw view at laptop height.

**P1 — should pass:**
8. Navigate away mid-transfer → confirm prompt (brand link / Disconnect / reload).
9. Privacy Mode: nav legible in dark; version pill matches sibling pills.
10. Activity: drawer opens, × dismisses, error is copyable.
11. Splash: dev CTA → Clean SDK; the top-nav Connect pill is inert on the splash.
12. Toasts appear below the nav, not over it.

---

## 6. Useful commands (Vercel)

```bash
SCOPE=team_Uql08jo75ikAKNUh2FXl1zj0
npx vercel ls aztec-bridge --scope $SCOPE                    # recent deployments + env + status
npx vercel inspect <deployment-url> --scope $SCOPE           # target/env, aliases, build info
gh run list --repo holonym-foundation/shield.human.tech \
  --workflow vercel-deploy-bridge.yml --limit 5              # CI deploy runs

# Manual prebuilt deploy (AVOID; only if CI is down — rebuild the SDK first!):
pnpm --filter @human.tech/clean.sdk build
npx vercel pull --yes --environment=testnet --scope $SCOPE
cd .. && npx vercel build --target=testnet --scope $SCOPE
npx vercel deploy --prebuilt --target=testnet --scope $SCOPE
# then verify: grep -rl "<activeDeploymentId>" .vercel/output --include=*.js
```

---

## 7. Rollback

Deploys are immutable. To roll back the testnet env, redeploy a known-good commit
(push it, or promote a prior good deployment in the Vercel dashboard → the testnet
env). Never hand-edit a live deployment. Confirm the rollback with the §5 P0 smoke test.
