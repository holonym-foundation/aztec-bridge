'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ALL_DEPLOYMENTS,
  ACTIVE_DEPLOYMENT_ID,
  DEPLOYMENT_ID,
  L1_NETWORKS,
  L2_NETWORKS,
} from '@/config'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useOnboardingStore } from '@/stores/useOnboardingStore'

// Current network, read from config (never hardcoded). Each Vercel deployment
// is pinned to ONE network — the L1 chain and the Aztec network are baked in at
// build time (see src/config/index.ts: the active network is derived from the
// active deployment's l1ChainId / name). L1_NETWORKS[0].title resolves to
// "Ethereum" / "Eth Sepolia"; L2_NETWORKS[0].title resolves to the Aztec
// chainName ("Aztec Testnet" / "Aztec V5" / "Aztec Devnet").
const L1_NETWORK = L1_NETWORKS[0]
const L2_NETWORK = L2_NETWORKS[0]

// ── Runtime network switching is NOT available in this app ──────────────────
// The deployment override (localStorage 'selectedDeploymentId') is honoured
// ONLY in development — production ignores it and always serves the active
// deployment (see getSelectedDeployment in src/config/index.ts). Switching
// between networks (e.g. testnet ↔ mainnet) means a *different Vercel
// deployment*, not a runtime toggle. So the network section below is
// DISPLAY-ONLY: it shows the current L1 + Aztec network and states plainly
// that other networks live on separate deployments, rather than faking a
// switch. The deployment-version list further down is a dev-only convenience
// and keeps its original reload-to-apply behaviour.

const DeploymentSelector: React.FC = () => {
  // Privacy Mode drops the nav onto the deep-maroon background; match the rest
  // of the nav (see Header.tsx) by switching text/surfaces to the dark variants.
  // Off-scale alphas use the bracket form (Header.tsx documents why:
  // tailwind.config.js replaces the opacity scale with {0,20,40,60,80,100}, so
  // `white/90`-style shorthand outside that set compiles to nothing).
  const { isPrivacyModeEnabled } = useBridgeStore()
  // Stay light-styled while the onboarding splash is up — the nav is lifted
  // onto the splash's light field there, so dark styling is unreadable (#94).
  const splashActive = useOnboardingStore((s) => s.splashActive)
  const isDark = isPrivacyModeEnabled && !splashActive
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(DEPLOYMENT_ID)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSelect = (id: string) => {
    if (id === selectedId) {
      setOpen(false)
      return
    }
    setSelectedId(id)
    // Store selection (clear override if selecting the default active deployment).
    if (id === ACTIVE_DEPLOYMENT_ID) {
      localStorage.removeItem('selectedDeploymentId')
    } else {
      localStorage.setItem('selectedDeploymentId', id)
    }
    // Reload to apply new deployment config (dev-only — production ignores the override).
    window.location.reload()
  }

  if (ALL_DEPLOYMENTS.length === 0) return null

  const currentDeployment = ALL_DEPLOYMENTS.find((d) => d.id === selectedId)
  const versionLabel = currentDeployment?.network.aztecVersion || selectedId
  const hasMultiple = ALL_DEPLOYMENTS.length > 1

  const caretColor = isDark ? 'text-white/[0.60]' : 'text-gray-400'
  const vColor = isDark ? 'text-white/[0.60]' : 'text-gray-500'
  const versionColor = isDark ? 'text-white/[0.90]' : 'text-[#0A0A0A]'
  const netColor = isDark ? 'text-white/[0.65]' : 'text-gray-500'

  return (
    <div className="relative flex justify-center" ref={dropdownRef}>
      {/* Collapsed indicator — bare control (no pill of its own; it lives inside
          the brand pill, #113). Shows the version + Aztec network, with a caret
          that reveals the full network detail on open. */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 max-w-full leading-none cursor-pointer"
        title={`${versionLabel} · ${L1_NETWORK?.title ?? ''} / ${L2_NETWORK?.title ?? ''}`}
      >
        <span className={`text-[10px] font-medium ${vColor}`}>v</span>
        <span className={`text-[10px] font-semibold ${versionColor}`}>{versionLabel}</span>
        {L2_NETWORK?.title && (
          <>
            <span className={`hidden sm:inline text-[10px] ${vColor}`}>·</span>
            <span className={`hidden sm:inline text-[10px] font-medium truncate max-w-[92px] ${netColor}`}>
              {L2_NETWORK.title}
            </span>
          </>
        )}
        <svg
          className={`w-2.5 h-2.5 transition-transform ${caretColor} ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full mt-2 w-[288px] rounded-xl shadow-lg z-50 py-1.5 border ${
            isDark ? 'bg-[#2A0E1C]/[0.97] border-white/[0.12] backdrop-blur-md' : 'bg-white border-[#E0E0E0]'
          }`}>
          {/* ── Current network (display-only) ─────────────────────────── */}
          <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-white/[0.60]' : 'text-gray-400'}`}>
            Network
          </div>
          {[L1_NETWORK, L2_NETWORK].filter(Boolean).map((n) => (
            <div key={n!.id} className="flex items-center gap-2.5 px-3 py-2">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isDark ? 'bg-white/[0.08]' : 'bg-[#F5F5F5]'}`}>
                <Image src={n!.img} alt="" width={16} height={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-medium truncate ${isDark ? 'text-white/[0.90]' : 'text-[#0A0A0A]'}`}>
                  {n!.title}
                </div>
                <div className={`text-[11px] ${isDark ? 'text-white/[0.50]' : 'text-gray-400'}`}>
                  {n!.symbol === 'ETH' && n!.network !== 'aztec' ? `L1 · chain ${n!.chainId}` : `L2 · Aztec`}
                </div>
              </div>
              <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold ${isDark ? 'text-[#FA8FC4]' : 'text-[#81133B]'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Active
              </span>
            </div>
          ))}
          <p className={`px-3 pt-1 pb-2 text-[10px] leading-snug ${isDark ? 'text-white/[0.50]' : 'text-gray-400'}`}>
            This app is pinned to one network per deployment. Other networks
            (e.g. mainnet) run on separate deployments — they can&apos;t be
            switched here.
          </p>

          {/* ── Deployment version (dev-only switch, preserved) ────────── */}
          {hasMultiple && (
            <>
              <div className={`mx-3 my-1 border-t ${isDark ? 'border-white/[0.12]' : 'border-[#EEEEEE]'}`} />
              <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-white/[0.60]' : 'text-gray-400'}`}>
                Deployment Version
              </div>
              {ALL_DEPLOYMENTS.map((d) => {
                const isSelected = d.id === selectedId
                const isDefault = d.id === ACTIVE_DEPLOYMENT_ID
                const deployDate = new Date(d.deployedAt)
                const dateStr = deployDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                const rowBg = isSelected
                  ? hoveredId === d.id
                    ? isDark ? 'rgba(255,255,255,0.14)' : '#E5E5E5'
                    : isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F0'
                  : hoveredId === d.id
                    ? isDark ? 'rgba(255,255,255,0.06)' : '#F5F5F5'
                    : 'transparent'
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelect(d.id)}
                    onMouseEnter={() => setHoveredId(d.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-3"
                    style={{ backgroundColor: rowBg }}>
                    <div className="flex-shrink-0 w-4 flex items-center justify-center">
                      {isSelected ? (
                        <svg className={`w-4 h-4 ${isDark ? 'text-white/[0.90]' : 'text-gray-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className={`w-4 h-4 rounded-full border ${isDark ? 'border-white/[0.20]' : 'border-gray-300'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-[13px] ${isSelected ? (isDark ? 'text-white/[0.90]' : 'text-[#0A0A0A]') : (isDark ? 'text-white/[0.65]' : 'text-gray-700')}`}>
                          {d.network.aztecVersion}
                        </span>
                        {isDefault && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-white/[0.12] text-white/[0.65]' : 'bg-gray-200 text-gray-600'}`}>
                            latest
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${isDark ? 'text-white/[0.50]' : 'text-gray-400'}`}>
                        {d.network.name} &middot; {dateStr}
                      </div>
                    </div>
                    <div className={`flex-shrink-0 text-[10px] text-right leading-tight ${isDark ? 'text-white/[0.50]' : 'text-gray-400'}`}>
                      <div>L1:{d.network.l1ChainId}</div>
                      <div>L2:{d.network.l2ChainId}</div>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default DeploymentSelector
