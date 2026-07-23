'use client'

import { Icon, loadIcons } from '@iconify/react'
import Image from 'next/image'
import React, { useEffect, useRef, useState } from 'react'
import { useWalletStore } from '@/stores/walletStore'
import { useAttestationCheck } from '@/hooks/useAttestationCheck'
import { shortAddr, accountLabel } from '@/hooks/useBindingStatus'
import { POCH_MINT_URL } from '@/config'
import { BRIDGE_MAX_DEPOSIT_USD, TRAVEL_RULE_THRESHOLD_USD } from '@/config/env.config'
import { silkUrl } from '@/config/l1.config'
import { LOGIN_METHODS } from '@/types/wallet'
import { copyToClipboard } from '@/utils'

// Preload the Phosphor glyphs used inside the chip + dropdown so iconify has
// them cached before first paint (same pattern Header uses for its own set).
if (typeof window !== 'undefined') {
  loadIcons([
    'ph:seal-check-fill',
    'ph:caret-down',
    'ph:link',
    'ph:link-simple',
    'ph:wallet',
    'ph:arrows-left-right',
    'ph:sign-out',
    'ph:identification-card',
    'ph:hand-soap',
    'ph:plus-circle',
    'ph:gauge',
    'ph:check',
    'ph:copy',
    'ph:warning-circle',
    'majesticons:open',
  ])
}

// ─── Brand assets reused from the app (never re-drawn) ──────────────────────
const EVM_NETWORK_ICON = '/assets/svg/network-logo.svg'
const AZTEC_ICON = '/assets/svg/aztec.svg'
const EVM_WALLET_FALLBACK = '/assets/wallets/wally-dark.svg'

// Compliance figures surfaced in the account dropdown. Both come from env
// (BRIDGE_MAX_DEPOSIT_USD, TRAVEL_RULE_THRESHOLD_USD) — never hardcoded — so
// they track config. Neither is NEXT_PUBLIC, so on the client `process.env`
// returns undefined and they resolve to their config defaults ($25k / $1,000).
const DEPOSIT_CAP_LABEL = `$${Number(BRIDGE_MAX_DEPOSIT_USD) / 1000}k`
const TRAVEL_RULE_LABEL = `$${Number(TRAVEL_RULE_THRESHOLD_USD).toLocaleString()}`

// ─── Theme helpers (ported from Header's glass-pill vocabulary; this app is
// Tailwind-only and the design system ships CSS modules, so the LOOK is
// reproduced, not imported). Every white/black-alpha uses the BRACKET form —
// the bare `/60` shorthand silently compiles to nothing under this repo's
// sparse opacity scale (see Header.tsx for the full note). ────────────────────
const GLASS_PILL =
  'backdrop-blur-md bg-white/[0.85] border border-[#E5E5E5]/80 shadow-[0_6px_18px_-6px_rgba(15,15,15,0.18),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200'
const GLASS_PILL_HOVER =
  'hover:bg-white hover:shadow-[0_10px_24px_-8px_rgba(15,15,15,0.24),0_1px_2px_rgba(0,0,0,0.04)]'
const GLASS_PILL_ACTIVE =
  'bg-white shadow-[0_10px_24px_-8px_rgba(15,15,15,0.24),0_1px_2px_rgba(0,0,0,0.04)]'
const GLASS_PILL_DARK =
  'backdrop-blur-md bg-white/[0.07] border border-white/[0.14] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.35)] transition-all duration-200'
const GLASS_PILL_DARK_HOVER =
  'hover:bg-white/[0.12] hover:border-white/[0.22] hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.35)]'
const GLASS_PILL_DARK_ACTIVE =
  'bg-white/[0.14] border-white/[0.22] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.35)]'

function glassPill(isDark: boolean, active = false): string {
  if (isDark) return `${GLASS_PILL_DARK} ${GLASS_PILL_DARK_HOVER} ${active ? GLASS_PILL_DARK_ACTIVE : ''}`
  return `${GLASS_PILL} ${GLASS_PILL_HOVER} ${active ? GLASS_PILL_ACTIVE : ''}`
}
function navText(isDark: boolean): string {
  return isDark ? 'text-white/[0.90]' : 'text-[#17235E]'
}
function mutedIconText(isDark: boolean): string {
  return isDark ? 'text-white/[0.60]' : 'text-gray-400'
}
function subtleText(isDark: boolean): string {
  return isDark ? 'text-white/[0.65]' : 'text-gray-500'
}
/** Shield accent — maroon on light, pink-40 on dark (maroon is too close to the
 *  dark-maroon Privacy background to read as an accent). */
function accentPink(isDark: boolean): string {
  return isDark ? 'text-[#FA8FC4]' : 'text-[#81133B]'
}
function hoverTint(isDark: boolean): string {
  return isDark ? 'hover:bg-white/[0.10]' : 'hover:bg-black/[0.04]'
}
function panelSurface(isDark: boolean): string {
  return isDark
    ? 'bg-[#2A0E1C]/[0.97] backdrop-blur-md border border-white/[0.12]'
    : 'bg-white/[0.97] backdrop-blur-md border border-[#E5E5E5]/80'
}
function panelDivider(isDark: boolean): string {
  return isDark ? 'border-white/[0.12]' : 'border-[#E5E5E5]'
}
function menuItemHover(isDark: boolean): string {
  return isDark ? 'hover:bg-white/[0.10]' : 'hover:bg-black/[0.04]'
}
/** Progress-track background under a fill bar. */
function trackBg(isDark: boolean): string {
  return isDark ? 'bg-white/[0.12]' : 'bg-black/[0.06]'
}

interface AccountChipProps {
  /** True when Privacy Mode is on and the page is on the dark maroon field. */
  isDark?: boolean
  /** Existing combined EVM→Aztec connect flow (Header owns the auto-connect). */
  onConnectWallet: () => void
  /** Existing Aztec-only connect action. */
  onConnectAztec: () => void
  /** L1 connection in flight (nothing connected yet). */
  isL1Connecting?: boolean
  /** L2 connection in flight (EVM up, Aztec connecting). */
  isL2Connecting?: boolean
  /** Native L1 balance string, already derived in Header from useL1TokenBalances. */
  l1NativeBalance?: string
  /** Hard-lock fund-losing actions (Disconnect) during an in-progress transfer. */
  actionsLocked?: boolean
  /** WAAP login method — gates the "Open Wallet" row (Header owns the store field). */
  loginMethod?: string | null
  /**
   * Actionable binding-conflict notice, rendered as a static BANNER at the top
   * of the dropdown (above the account list) rather than a floating overlay that
   * would cover the account-selection rows (issue #282).
   */
  conflictNotice?: string
  /** True when the notice is a hard server conflict (deeper accent) vs a softer pre-warn. */
  conflictSevere?: boolean
  /**
   * L2 account the SERVER has disclosed as the pair for the connected EVM wallet
   * (authoritative bound response — never localStorage). The matching row in the
   * Switch Account list gets a "Linked" badge so the user can pick it (issue #284).
   */
  linkedAccountAddress?: string
}

/**
 * Account Chip (Variant A) — a single skinny wallet-only chip in the top-right
 * nav that opens an account dropdown. Encapsulates the connect / connected
 * states and the Wallets · Identity & proofs · Limits & usage · Disconnect
 * dropdown. Sits standalone at the right end of the nav at the uniform top-row
 * height (h-14 / CHIP_H), like the Shield brand + humanity chips.
 *
 * The humanity/points chip is a SEPARATE element that stays beside this in the
 * Header — it is intentionally NOT folded in here.
 */
const AccountChip: React.FC<AccountChipProps> = ({
  isDark = false,
  onConnectWallet,
  onConnectAztec,
  isL1Connecting = false,
  isL2Connecting = false,
  l1NativeBalance,
  actionsLocked = false,
  loginMethod,
  conflictNotice,
  conflictSevere = false,
  linkedAccountAddress,
}) => {
  const {
    waapAddress,
    isWaapConnected,
    waapWalletIcon,
    disconnectWaapWallet,
    aztecAddress,
    aztecAlias,
    isAztecConnected,
    disconnectAztecWallet,
    availableAccounts,
    switchAztecAccount,
  } = useWalletStore()

  const { data: attestation, isFetching: attFetching } = useAttestationCheck()
  const eligible = attestation?.eligible ?? false
  const method = attestation?.method ?? null
  const passportScore = attestation?.passportScore
  const passportThreshold = attestation?.passportThreshold
  const remainingDepositUsd = attestation?.remainingDepositUsd
  const reservedDepositUsd = attestation?.reservedDepositUsd
  const travelRuleRemainingUsd = attestation?.travelRuleRemainingUsd
  const depositLimitReached = attestation?.depositLimitReached ?? false

  const scorePasses =
    typeof passportScore === 'number' &&
    typeof passportThreshold === 'number' &&
    passportScore >= passportThreshold
  const isPoch = method === 'poch'
  // On the Passport tier = verified via Passport but not yet holding Clean Hands.
  const onPassportTier = !isPoch && (method === 'passport' || scorePasses)
  const isVerified = eligible || scorePasses || isPoch

  const [open, setOpen] = useState(false)
  const [aztecSwitchOpen, setAztecSwitchOpen] = useState(false)
  // #275: which wallet row was just copied (keyed by address) so the check +
  // "Copied" flip is scoped to the row the user acted on, not both rows.
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // #275: copies the FULL address (not the truncated label), flips to a check +
  // "Copied" for ~1.5s, keeping the dropdown open so the user can copy again.
  const handleCopy = async (addr?: string) => {
    if (!addr) return
    await copyToClipboard(addr)
    setCopiedKey(addr)
    setTimeout(() => setCopiedKey((k) => (k === addr ? null : k)), 1500)
  }

  // ── State 1: nothing connected → a compact "Connect wallet" chip. ──
  if (!isWaapConnected && !isAztecConnected) {
    return (
      <button
        type="button"
        onClick={onConnectWallet}
        disabled={isL1Connecting}
        title={isL1Connecting ? 'Connecting…' : 'Connect wallet'}
        aria-label={isL1Connecting ? 'Connecting wallet' : 'Connect wallet'}
        className={`flex items-center justify-center gap-2 h-14 w-14 sm:w-auto px-0 sm:px-5 rounded-[20px] flex-shrink-0 ${
          isDark ? GLASS_PILL_DARK : GLASS_PILL
        } ${isL1Connecting ? 'opacity-60 cursor-not-allowed' : `${isDark ? GLASS_PILL_DARK_HOVER : GLASS_PILL_HOVER} cursor-pointer`}`}
      >
        <Icon icon="ph:wallet" width={16} height={16} className={`${accentPink(isDark)} flex-shrink-0`} />
        <span className={`hidden sm:inline text-xs sm:text-sm font-medium ${navText(isDark)} whitespace-nowrap`}>
          {isL1Connecting ? 'Connecting…' : 'Connect wallet'}
        </span>
      </button>
    )
  }

  const evmIcon = waapWalletIcon || EVM_WALLET_FALLBACK
  const bothConnected = isWaapConnected && isAztecConnected

  const label = bothConnected ? 'Account' : waapAddress ? shortAddr(waapAddress) : 'Wallet'

  const EvmAvatar = (
    <span className="flex w-6 h-6 p-[2px] justify-center items-center rounded-full bg-[#FDE7F3] flex-shrink-0">
      <Image src={evmIcon} alt="" width={18} height={18} />
    </span>
  )
  const AztecAvatar = (
    <span className="flex w-6 h-6 p-[3px] justify-center items-center rounded-full bg-[#FDE7F3] flex-shrink-0">
      <Image src={AZTEC_ICON} alt="" width={16} height={16} />
    </span>
  )

  return (
    <div className="relative flex-shrink-0" ref={rootRef}>
      {/* Skinny collapsed chip — a SINGLE row (stacked avatars + Account + verified
          + caret) at the uniform top-row height (h-14 / CHIP_H), never two stacked
          wallet rows. */}
      <div
        className={`flex items-center gap-1 h-14 pl-2 pr-2 rounded-[20px] max-w-[200px] sm:max-w-[260px] ${glassPill(isDark, open)}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={open}
          className="flex items-center gap-1.5 min-w-0 flex-1 pl-0.5 py-1 cursor-pointer"
        >
          {/* Avatars: stacked (EVM + Aztec) when both are connected. */}
          <span className="flex items-center flex-shrink-0">
            {isWaapConnected && EvmAvatar}
            {bothConnected && <span className="-ml-2">{AztecAvatar}</span>}
            {!isWaapConnected && isAztecConnected && AztecAvatar}
          </span>
          {/* EVM network glyph (only meaningful in the EVM-only state). */}
          {isWaapConnected && !bothConnected && (
            <Image src={EVM_NETWORK_ICON} alt="" width={13} height={13} className="flex-shrink-0" />
          )}
          <span className={`text-xs font-medium truncate ${navText(isDark)}`} title={waapAddress || ''}>
            {label}
          </span>
          {bothConnected && isVerified && (
            <Icon
              icon="ph:seal-check-fill"
              width={15}
              height={15}
              className={`flex-shrink-0 ${accentPink(isDark)}`}
              aria-label="Personhood verified"
            />
          )}
          <Icon
            icon="ph:caret-down"
            width={12}
            height={12}
            className={`ml-auto flex-shrink-0 ${mutedIconText(isDark)} transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* EVM connected, Aztec NOT → inline Connect Aztec affordance (sibling
            button, not nested). #287: clear ACTIVE treatment when idle (tinted
            fill + border + hover) so it can't read as disabled; only faded +
            cursor-not-allowed while actually connecting. */}
        {isWaapConnected && !isAztecConnected && (
          <button
            type="button"
            onClick={onConnectAztec}
            disabled={isL2Connecting}
            title="Connect Aztec wallet"
            className={`flex items-center gap-1 flex-shrink-0 pl-1.5 pr-2 py-1 rounded-full text-[11px] font-medium border ${
              isL2Connecting
                ? 'opacity-60 cursor-not-allowed border-transparent'
                : `cursor-pointer ${
                    isDark
                      ? 'bg-[#FA8FC4]/[0.14] border-[#FA8FC4]/[0.30] hover:bg-[#FA8FC4]/[0.22]'
                      : 'bg-[#FA8FC4]/[0.16] border-[#81133B]/[0.25] hover:bg-[#FA8FC4]/[0.26]'
                  }`
            } ${accentPink(isDark)}`}
          >
            <Image src={AZTEC_ICON} alt="" width={13} height={13} className="flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{isL2Connecting ? '…' : 'Connect Aztec'}</span>
          </button>
        )}
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 mt-2 z-50 w-[290px] max-w-[calc(100vw-1.5rem)] max-h-[min(72vh,560px)] overflow-y-auto rounded-[16px] shadow-lg py-2 flex flex-col ${panelSurface(isDark)} ${navText(isDark)}`}
        >
          {/* #282: the binding-conflict notice is a STATIC banner at the top of the
              dropdown, above the account list — so it can never float over and
              block the Switch / account-selection rows. */}
          {conflictNotice && (
            <div
              role="alert"
              className={`mx-2 mb-1 rounded-xl p-2.5 flex items-start gap-2 border-l-2 ${
                conflictSevere ? 'border-l-[#E3357E]' : 'border-l-[#FA8FC4]'
              } ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.03]'}`}
            >
              <Icon icon="ph:warning-circle" width={15} height={15} className={`mt-[1px] flex-shrink-0 ${accentPink(isDark)}`} />
              <p className={`text-[11px] leading-snug ${navText(isDark)}`}>{conflictNotice}</p>
            </div>
          )}

          {/* ── Wallets ── */}
          <SectionLabel isDark={isDark}>Wallets</SectionLabel>

          {isWaapConnected && (
            <WalletRow
              isDark={isDark}
              avatar={EvmAvatar}
              networkIcon={EVM_NETWORK_ICON}
              primary={waapAddress ? shortAddr(waapAddress) : 'EVM wallet'}
              secondary={l1NativeBalance ? `${l1NativeBalance} ETH` : 'Ethereum'}
              fullAddress={waapAddress || undefined}
              copied={!!waapAddress && copiedKey === waapAddress}
              onCopy={() => handleCopy(waapAddress || undefined)}
              onSwitch={onConnectWallet}
              switchTitle="Re-open the wallet login to switch EVM account"
            />
          )}

          {/* Open Wallet — only for the embedded WAAP login (opens the Silk UI). */}
          {loginMethod === LOGIN_METHODS.WAAP && (
            <button
              type="button"
              onClick={() => window.open(silkUrl, '_blank', 'noopener,noreferrer')}
              className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg text-left transition-colors duration-150 ${menuItemHover(isDark)} cursor-pointer`}
            >
              <Icon icon="majesticons:open" width={16} height={16} className={mutedIconText(isDark)} />
              <span className={`text-xs font-medium ${navText(isDark)}`}>Open Wallet</span>
            </button>
          )}

          {isAztecConnected && (
            <>
              <WalletRow
                isDark={isDark}
                avatar={AztecAvatar}
                primary={aztecAlias || (aztecAddress ? shortAddr(aztecAddress) : 'Aztec account')}
                secondary={aztecAddress ? shortAddr(aztecAddress) : 'Aztec'}
                fullAddress={aztecAddress || undefined}
                copied={!!aztecAddress && copiedKey === aztecAddress}
                onCopy={() => handleCopy(aztecAddress || undefined)}
                onSwitch={availableAccounts.length > 1 ? () => setAztecSwitchOpen((v) => !v) : undefined}
                switchTitle="Switch Azguard account"
                switchActive={aztecSwitchOpen}
              />
              {aztecSwitchOpen && availableAccounts.length > 1 && (
                <div className="px-2 pb-1">
                  {availableAccounts.map((acc, i) => {
                    const isCurrent = acc.address === aztecAddress
                    // #284: mark the account the server disclosed as bound to the
                    // connected EVM wallet, so the user can spot and pick it.
                    const isLinked =
                      !!linkedAccountAddress && acc.address.toLowerCase() === linkedAccountAddress.toLowerCase()
                    return (
                      <button
                        key={acc.address}
                        type="button"
                        onClick={() => {
                          if (!isCurrent) switchAztecAccount(acc)
                          setAztecSwitchOpen(false)
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors duration-150 ${
                          isCurrent ? 'cursor-default' : `${menuItemHover(isDark)} cursor-pointer`
                        }`}
                      >
                        <Icon
                          icon={isCurrent ? 'ph:check' : 'ph:wallet'}
                          width={15}
                          height={15}
                          className={isCurrent ? accentPink(isDark) : subtleText(isDark)}
                        />
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs truncate">{accountLabel(acc, i)}</span>
                          <span className={`text-[10px] ${mutedIconText(isDark)}`}>
                            {shortAddr(acc.address)}
                            {isCurrent ? ' · Current' : ''}
                          </span>
                        </span>
                        {isLinked && (
                          <span
                            className={`ml-auto flex items-center gap-1 text-[10px] font-medium whitespace-nowrap ${accentPink(isDark)}`}
                            title="Linked to your EVM wallet"
                          >
                            <Icon icon="ph:link-simple" width={13} height={13} className="flex-shrink-0" />
                            Linked
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Link a New Wallet — DISABLED variant. Non-interactive (no onClick)
              until the WAAP wallet-linking flow ships; opacity-40 (opacity-50 is a
              no-op on this repo's sparse opacity scale) + muted + cursor-not-allowed
              + select-none make the "Coming soon" state read as intentionally inert. */}
          <div
            aria-disabled="true"
            className="flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg opacity-40 cursor-not-allowed select-none"
          >
            <Icon icon="ph:link" width={16} height={16} className={mutedIconText(isDark)} />
            <span className={`text-xs font-medium ${mutedIconText(isDark)}`}>Link a New Wallet</span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${trackBg(isDark)} ${subtleText(isDark)}`}>
              Coming soon
            </span>
          </div>

          <Divider isDark={isDark} />

          {/* ── Identity & proofs ── */}
          <SectionLabel isDark={isDark}>Identity &amp; proofs</SectionLabel>

          <ProofRow
            isDark={isDark}
            icon="ph:identification-card"
            title="Passport"
            caption={`Required · ${TRAVEL_RULE_LABEL} per human`}
            status={
              attFetching
                ? 'Checking…'
                : typeof passportScore === 'number'
                  ? `${passportScore}`
                  : isPoch
                    ? 'Covered by Clean Hands'
                    : 'Not verified'
            }
            good={scorePasses || isPoch}
          />
          <ProofRow
            isDark={isDark}
            icon="ph:hand-soap"
            title="Clean Hands SBT"
            caption={`Unlocks ${DEPOSIT_CAP_LABEL}`}
            status={attFetching ? 'Checking…' : isPoch ? 'Verified' : 'Not held'}
            good={isPoch}
          />
          {/* Contextual next step: no proof → Get verified; Passport tier →
              Upgrade to Clean Hands; already Clean Hands → hidden. */}
          {!isPoch && (
            <a
              href={onPassportTier ? POCH_MINT_URL : 'https://app.passport.xyz'}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg ${menuItemHover(isDark)} cursor-pointer transition-colors duration-150`}
            >
              <Icon icon="ph:plus-circle" width={16} height={16} className={accentPink(isDark)} />
              <span className={`text-xs font-medium ${navText(isDark)}`}>
                {onPassportTier ? 'Upgrade to Clean Hands' : 'Get verified'}
              </span>
            </a>
          )}

          <Divider isDark={isDark} />

          {/* ── Limits & usage ── */}
          <SectionLabel isDark={isDark}>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon="ph:gauge" width={13} height={13} className={mutedIconText(isDark)} />
              Limits &amp; usage
            </span>
          </SectionLabel>

          <div className="px-4 py-1 flex flex-col gap-2.5">
            <LimitBar
              isDark={isDark}
              label="Deposit allowance"
              // No client-side cap TOTAL is exposed, so the used/limit ratio
              // can't be computed — show the real remaining $ and flag the bar
              // as an estimate rather than fabricating a percentage.
              valueText={
                depositLimitReached
                  ? 'Reached'
                  : typeof remainingDepositUsd === 'number'
                    ? `$${remainingDepositUsd.toLocaleString()} left`
                    : 'No limit'
              }
              pct={depositLimitReached ? 100 : undefined}
              placeholder={!depositLimitReached && typeof remainingDepositUsd === 'number'}
              tint="maroon"
            />
            {typeof reservedDepositUsd === 'number' && reservedDepositUsd > 0 && (
              <LimitBar
                isDark={isDark}
                label="On hold (pending)"
                valueText={`$${reservedDepositUsd.toLocaleString()}`}
                pct={undefined}
                placeholder
                tint="amber"
              />
            )}
            <LimitBar
              isDark={isDark}
              label={`Lifetime limit (${TRAVEL_RULE_LABEL}/human)`}
              valueText={
                typeof travelRuleRemainingUsd === 'number'
                  ? `$${travelRuleRemainingUsd.toLocaleString()} left`
                  : 'No limit'
              }
              pct={undefined}
              placeholder={typeof travelRuleRemainingUsd === 'number'}
              tint="navy"
            />
          </div>

          <Divider isDark={isDark} />

          {/* ── Disconnect (lives here now — removed from the progress bar in #61) ── */}
          <button
            type="button"
            disabled={actionsLocked}
            title={actionsLocked ? 'Locked during transfer to protect your funds.' : undefined}
            onClick={() => {
              if (actionsLocked) return
              if (isAztecConnected) void disconnectAztecWallet()
              if (isWaapConnected) void disconnectWaapWallet()
              setOpen(false)
            }}
            className={`flex items-center gap-2 mx-2 px-2 py-2 rounded-lg transition-colors duration-150 ${
              actionsLocked
                ? 'opacity-40 cursor-not-allowed'
                : `${menuItemHover(isDark)} cursor-pointer`
            } ${isDark ? 'text-[#FF6B6B]' : 'text-red'}`}
          >
            <Icon icon="ph:sign-out" width={18} height={18} />
            <span className="text-sm">Disconnect</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Small presentational building blocks (mirror the DS AccountDrawer
// section / row structure, in Shield's Tailwind + Phosphor stack) ────

const SectionLabel: React.FC<{ isDark: boolean; children: React.ReactNode }> = ({ isDark, children }) => (
  <div className={`px-4 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide ${mutedIconText(isDark)}`}>
    {children}
  </div>
)

const Divider: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className={`border-t ${panelDivider(isDark)} my-1.5`} />
)

const WalletRow: React.FC<{
  isDark: boolean
  avatar: React.ReactNode
  networkIcon?: string
  primary: string
  secondary: string
  /** Full address to copy on hover (#275). */
  fullAddress?: string
  copied?: boolean
  onCopy?: () => void
  onSwitch?: () => void
  switchTitle?: string
  switchActive?: boolean
}> = ({ isDark, avatar, networkIcon, primary, secondary, fullAddress, copied, onCopy, onSwitch, switchTitle, switchActive }) => (
  // #275: `group` lets hover/focus reveal the copy control. This is a div (not a
  // button) so the copy/switch buttons aren't nested inside a button.
  <div className="group flex items-center gap-2 px-4 py-1.5">
    <span className="relative flex-shrink-0">
      {avatar}
      {networkIcon && (
        <Image
          src={networkIcon}
          alt=""
          width={12}
          height={12}
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
        />
      )}
    </span>
    <span className="flex flex-col min-w-0 flex-1">
      <span className={`text-xs font-medium truncate ${navText(isDark)}`}>{primary}</span>
      <span className={`text-[10px] ${subtleText(isDark)} truncate`}>{secondary}</span>
    </span>
    {fullAddress && onCopy && (
      <button
        type="button"
        onClick={onCopy}
        title="Copy address"
        aria-label="Copy full address"
        className={`flex items-center gap-1 flex-shrink-0 px-1.5 py-1 rounded-full text-[11px] font-medium opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity duration-150 ${hoverTint(isDark)} ${
          copied ? accentPink(isDark) : subtleText(isDark)
        }`}
      >
        <Icon icon={copied ? 'ph:check' : 'ph:copy'} width={14} height={14} />
        {copied && <span>Copied</span>}
      </button>
    )}
    {onSwitch && (
      <button
        type="button"
        onClick={onSwitch}
        title={switchTitle}
        className={`flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-full text-[11px] font-medium ${hoverTint(isDark)} ${
          switchActive ? accentPink(isDark) : subtleText(isDark)
        }`}
      >
        <Icon icon="ph:arrows-left-right" width={13} height={13} />
        Switch
      </button>
    )}
  </div>
)

const ProofRow: React.FC<{
  isDark: boolean
  icon: string
  title: string
  caption: string
  status: string
  good: boolean
}> = ({ isDark, icon, title, caption, status, good }) => (
  <div className="flex items-center gap-2 px-4 py-1.5">
    <Icon icon={icon} width={16} height={16} className={good ? accentPink(isDark) : mutedIconText(isDark)} />
    <span className="flex flex-col min-w-0 flex-1">
      <span className={`text-xs font-medium ${navText(isDark)}`}>{title}</span>
      <span className={`text-[10px] ${subtleText(isDark)}`}>{caption}</span>
    </span>
    <span
      className={`flex items-center gap-1 flex-shrink-0 text-[11px] font-medium ${
        good ? accentPink(isDark) : subtleText(isDark)
      }`}
    >
      {good && <Icon icon="ph:seal-check-fill" width={13} height={13} />}
      {status}
    </span>
  </div>
)

const LimitBar: React.FC<{
  isDark: boolean
  label: string
  valueText: string
  pct?: number
  /** True when the bar is an unknown-ratio placeholder (no total exposed). */
  placeholder?: boolean
  tint: 'maroon' | 'amber' | 'navy'
}> = ({ isDark, label, valueText, pct, placeholder, tint }) => {
  const fillColor =
    tint === 'maroon'
      ? isDark
        ? 'bg-[#FA8FC4]'
        : 'bg-[#81133B]'
      : tint === 'amber'
        ? 'bg-[#F79009]'
        : isDark
          ? 'bg-white/[0.40]'
          : 'bg-[#17235E]'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] ${subtleText(isDark)} truncate`}>{label}</span>
        <span className={`text-[11px] font-medium ${navText(isDark)} flex-shrink-0`}>{valueText}</span>
      </div>
      <div className={`w-full h-1.5 rounded-full overflow-hidden ${trackBg(isDark)}`}>
        {typeof pct === 'number' ? (
          <div className={`h-full rounded-full ${fillColor}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        ) : placeholder ? (
          // Unknown ratio (no cap total client-side): a striped placeholder
          // track so the value above reads as real while the bar is clearly
          // an estimate, not a fabricated fill level.
          <div
            className="h-full w-full opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(129,19,59,0.35) 0, rgba(129,19,59,0.35) 4px, transparent 4px, transparent 8px)',
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

export default AccountChip
