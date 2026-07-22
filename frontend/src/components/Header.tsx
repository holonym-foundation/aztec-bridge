'use client'

import { Icon, loadIcons } from '@iconify/react'
import { useToast } from '@/hooks/useToast'
import { useWalletStore } from '@/stores/walletStore'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useL1TokenBalances } from '@/hooks/useL1Operations'
import { LOGIN_METHODS, WalletType } from '@/types/wallet'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { silkUrl } from '@/config/l1.config'
import { L1_CHAIN_ID, POCH_MINT_URL } from '@/config'
import DeploymentSelector from '@/components/DeploymentSelector'
import { useExplainerStore } from '@/stores/useExplainerStore'
import { useOnboardingStore } from '@/stores/useOnboardingStore'
import { useL1Humanity } from '@/hooks/useL1Humanity'
import {
  useBindingStatus,
  useSessionLinkedL2,
  describeConflict,
  conflictMessage,
  disclosedLinkedL2,
  accountLabel,
  shortAddr,
} from '@/hooks/useBindingStatus'

/** Delay before auto-starting Aztec wallet discovery after WaaP connects. */
const AZTEC_AUTO_CONNECT_DELAY_MS = 2000

// Preload the icons used inside the wallet dropdown, the humanity/points
// chip and the mobile nav toggle so they're cached in iconify's store before
// those elements first render. Module-level + window-guard so it runs once
// per page in the browser only.
if (typeof window !== 'undefined') {
  loadIcons([
    'ph:copy',
    'majesticons:open',
    'ph:wallet',
    'ph:wallet-fill',
    'ph:sign-out',
    'ph:question',
    'ph:caret-down',
    'ph:list',
    'ph:x',
    'ph:book-open',
    'ph:gas-pump',
    'ph:link-simple',
    'ph:check',
    'ph:warning-circle',
    'ph:info',
    'ph:hand-soap',
  ])
}

/**
 * Floating "glass pill" material merged in from the design-system SiteTopBar
 * (human-tech-design-system/src/SiteTopBar: translucent white, blurred,
 * soft border, layered shadow, brightens on hover). Reproduced as Tailwind
 * classes rather than imported — this app is Tailwind-only and the design
 * system component ships CSS modules, so the look is ported, not the code.
 */
const GLASS_PILL =
  'backdrop-blur-md bg-white/[0.85] border border-[#E5E5E5]/80 shadow-[0_6px_18px_-6px_rgba(15,15,15,0.18),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200'
const GLASS_PILL_HOVER =
  'hover:bg-white hover:shadow-[0_10px_24px_-8px_rgba(15,15,15,0.24),0_1px_2px_rgba(0,0,0,0.04)]'
const GLASS_PILL_ACTIVE = 'bg-white shadow-[0_10px_24px_-8px_rgba(15,15,15,0.24),0_1px_2px_rgba(0,0,0,0.04)]'

/**
 * Dark-mode counterparts of the glass pill, used when Privacy Mode is on and
 * the page drops to the deep-maroon background (see ClientLayout's
 * `showPrivacyBackground` overlay, rgba(31,8,22,0.66)). Same frosted-glass
 * material — translucent + blurred + bordered — just re-tuned so it reads as
 * "dark glass" instead of a light pill floating on a dark field: a faint
 * white wash instead of near-opaque white, and shadows built from black
 * instead of the light pill's soft warm-grey.
 */
const GLASS_PILL_DARK =
  'backdrop-blur-md bg-white/[0.07] border border-white/[0.14] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.35)] transition-all duration-200'
const GLASS_PILL_DARK_HOVER =
  'hover:bg-white/[0.12] hover:border-white/[0.22] hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.35)]'
const GLASS_PILL_DARK_ACTIVE = 'bg-white/[0.14] border-white/[0.22] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.35)]'

/** Merges the base/hover/active glass-pill classes for the given theme in one call. */
function glassPill(isDark: boolean, active = false): string {
  if (isDark) return `${GLASS_PILL_DARK} ${GLASS_PILL_DARK_HOVER} ${active ? GLASS_PILL_DARK_ACTIVE : ''}`
  return `${GLASS_PILL} ${GLASS_PILL_HOVER} ${active ? GLASS_PILL_ACTIVE : ''}`
}

/** Nav/body text — navy on light, near-white on the dark privacy background. */
function navText(isDark: boolean): string {
  return isDark ? 'text-white/[0.90]' : 'text-[#17235E]'
}
// NOTE: every white/black-alpha class in this file below uses the bracket
// form (e.g. `text-white/[0.60]`), never the bare `text-white/60` shorthand.
// tailwind.config.js overrides the `opacity` theme scale to a sparse set
// ({0,20,40,60,80,100}) for the standalone `opacity-*` utility, and that
// same scale gates the color-alpha shorthand — any `/<n>` not in that set
// silently compiles to *no rule at all*, so the element falls back to an
// inherited color (black text, opaque backgrounds) instead of erroring.
// Bracket values bypass the scale entirely and always compile.

/**
 * Muted icon/caret/label tone (was text-gray-400). Still legibly readable
 * against the dark-maroon surface — white/60, not a washed-out low-contrast
 * grey — reserved for secondary labels, not decorative/disabled affordances.
 */
function mutedIconText(isDark: boolean): string {
  return isDark ? 'text-white/[0.60]' : 'text-gray-400'
}
/** Secondary muted tone (was text-gray-500). */
function subtleText(isDark: boolean): string {
  return isDark ? 'text-white/[0.65]' : 'text-gray-500'
}
/**
 * Shield-pink accent used for the "verified" state. On dark, #81133B sits too
 * close in hue/value to the deep-maroon background to read as an accent, so
 * this swaps to pink-40 (#FA8FC4) — already part of this app's own palette
 * (it's one of the MeshGradient stops in ClientLayout) — for contrast.
 */
function accentPink(isDark: boolean): string {
  return isDark ? 'text-[#FA8FC4]' : 'text-[#81133B]'
}
/** Row hover tint inside the flat (borderless) wallet-cluster rows. */
function hoverTint(isDark: boolean): string {
  return isDark ? 'hover:bg-white/[0.10]' : 'hover:bg-black/[0.04]'
}
/** Row active/open tint, same rows as hoverTint. */
function activeTint(isDark: boolean): string {
  return isDark ? 'bg-white/[0.14]' : 'bg-black/[0.05]'
}
/** Opaque-ish dropdown/panel surface — deliberately more solid than the nav pills so menu text stays legible over whatever's behind it. */
function panelSurface(isDark: boolean): string {
  return isDark
    ? 'bg-[#2A0E1C]/[0.95] backdrop-blur-md border border-white/[0.12]'
    : 'bg-white/[0.95] backdrop-blur-md border border-[#E5E5E5]/80'
}
/** Hairline divider/border inside panels (was border-[#E5E5E5]). */
function panelDivider(isDark: boolean): string {
  return isDark ? 'border-white/[0.12]' : 'border-[#E5E5E5]'
}
/** Menu-row hover (was hover:bg-latest-grey-300). */
function menuItemHover(isDark: boolean): string {
  return isDark ? 'hover:bg-white/[0.10]' : 'hover:bg-latest-grey-300'
}

// Humanity Score is wired to the real L1-only proof-of-personhood result via
// useL1Humanity (POCH first, Passport fallback — see HumanityPointsChip below).
// TODO: Points still has NO live per-user source in this app (no points API,
// hook, or store exists today). This stub must be replaced by a real fetch from
// the points backend (the passport/Covenant HUMN Points service) threaded
// through the `points` prop. Until then the chip shows this placeholder — never
// a fabricated per-action breakdown.
const PLACEHOLDER_POINTS = 1240

// Same copy the BridgeHeader guard uses — keep them identical so the warning
// reads the same whether it fires from the bridge header or the top nav.
const TRANSFER_LEAVE_CONFIRM =
  "Leave now? Your in-progress transfer's recovery data could be lost — export a backup first."

/**
 * Canonical "verified / proof-of-personhood" glyph, ported from the
 * design-system icon set (human-tech-design-system/src/icons/custom-verified.svg)
 * — used elsewhere for humanity-verification chips. Inlined as raw SVG
 * rather than imported since the design system isn't a dependency here.
 */
const VerifiedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 22 22" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M16.2323 4.74006L16.7182 3.86604L16.7179 3.86584L16.2323 4.74006ZM18.2802 6.08939L19.0158 5.412L19.0147 5.41079L18.2802 6.08939ZM19.0648 7.42406L18.1152 7.73745L18.1155 7.73842L19.0648 7.42406ZM19.0648 14.5759L18.1154 14.262L18.1152 14.2625L19.0648 14.5759ZM18.2802 15.9106L19.0147 16.5892L19.0158 16.5879L18.2802 15.9106ZM16.2323 17.2599L16.7179 18.1341L16.7182 18.1339L16.2323 17.2599ZM13.8424 18.5872L13.3569 17.713L13.3567 17.7131L13.8424 18.5872ZM11.7388 19.5644L11.9378 20.5444L11.9412 20.5437L11.7388 19.5644ZM10.2612 19.5644L10.0588 20.5437L10.0622 20.5444L10.2612 19.5644ZM8.15761 18.5872L8.64325 17.7131L8.64313 17.713L8.15761 18.5872ZM5.76767 17.2599L5.28178 18.1339L5.28214 18.1341L5.76767 17.2599ZM3.72075 15.9106L4.45603 15.2328L4.45598 15.2327L3.72075 15.9106ZM2.93517 14.5759L3.88465 14.2621L3.88462 14.262L2.93517 14.5759ZM2.93517 7.42406L3.88462 7.73796L3.88465 7.73787L2.93517 7.42406ZM3.72075 6.08939L4.45599 6.76721L4.45603 6.76716L3.72075 6.08939ZM5.76767 4.74006L5.28214 3.86584L5.28178 3.86604L5.76767 4.74006ZM8.15759 3.41273L8.64312 4.28695L8.64323 4.28689L8.15759 3.41273ZM10.2612 2.43556L10.0597 1.45607L10.0588 1.45626L10.2612 2.43556ZM11.7388 2.43556L11.9412 1.45625L11.9403 1.45607L11.7388 2.43556ZM13.8424 3.41273L13.3568 4.28689L13.3569 4.28695L13.8424 3.41273ZM7.92586 10.2929C7.53533 9.90235 6.90217 9.90235 6.51164 10.2929C6.12112 10.6834 6.12112 11.3166 6.51164 11.7071L7.92586 10.2929ZM9.73958 13.5208L9.03248 14.2279C9.423 14.6184 10.0562 14.6184 10.4467 14.2279L9.73958 13.5208ZM15.4884 9.18625C15.8789 8.79573 15.8789 8.16256 15.4884 7.77204C15.0978 7.38151 14.4647 7.38151 14.0741 7.77204L15.4884 9.18625ZM15.7464 5.61408C16.9044 6.25783 17.2796 6.47998 17.5457 6.768L19.0147 5.41079C18.4796 4.83164 17.7566 4.44329 16.7182 3.86604L15.7464 5.61408ZM17.5445 6.76678C17.8017 7.04603 17.9962 7.37697 18.1152 7.73745L20.0145 7.11067C19.8063 6.47982 19.4658 5.90069 19.0158 5.41201L17.5445 6.76678ZM18.1155 7.73842C18.2379 8.10804 18.25 8.54282 18.25 9.86881H20.25C20.25 8.6813 20.2621 7.85842 20.0141 7.1097L18.1155 7.73842ZM18.25 9.86881V12.1311H20.25V9.86881H18.25ZM18.25 12.1311C18.25 13.4559 18.238 13.8912 18.1154 14.262L20.0143 14.8898C20.262 14.1405 20.25 13.3181 20.25 12.1311H18.25ZM18.1152 14.2625C17.9962 14.623 17.8017 14.9539 17.5445 15.2332L19.0158 16.5879C19.4658 16.0993 19.8063 15.5201 20.0145 14.8893L18.1152 14.2625ZM17.5457 15.232C17.2796 15.52 16.9044 15.7421 15.7464 16.3859L16.7182 18.1339C17.7566 17.5567 18.4796 17.1683 19.0147 16.5892L17.5457 15.232ZM13.3567 17.7131C12.2652 18.3195 11.9002 18.5099 11.5364 18.5851L11.9412 20.5437C12.6752 20.392 13.3494 20.0051 14.328 19.4614L13.3567 17.7131ZM11.5398 18.5844C11.1836 18.6567 10.8164 18.6567 10.4602 18.5844L10.0622 20.5444C10.6811 20.6701 11.3189 20.6701 11.9378 20.5444L11.5398 18.5844ZM10.4636 18.5851C10.0998 18.5099 9.73482 18.3195 8.64325 17.7131L7.67196 19.4614C8.6506 20.0051 9.32485 20.392 10.0588 20.5437L10.4636 18.5851ZM6.25356 16.3859C5.09526 15.7419 4.72086 15.5201 4.45603 15.2328L2.98547 16.5883C3.51997 17.1682 4.24374 17.5568 5.28178 18.1339L6.25356 16.3859ZM4.45598 15.2327C4.1986 14.9536 4.00381 14.6226 3.88465 14.2621L1.98568 14.8897C2.19422 15.5207 2.5351 16.0998 2.98552 16.5884L4.45598 15.2327ZM3.88462 14.262C3.76202 13.8911 3.75 13.4568 3.75 12.1311H1.75C1.75 13.319 1.73798 14.1405 1.98571 14.8898L3.88462 14.262ZM3.75 12.1311V9.86881H1.75V12.1311H3.75ZM3.75 9.86881C3.75 8.54405 3.76202 8.1088 3.88462 7.73796L1.98571 7.11016C1.73798 7.85949 1.75 8.6819 1.75 9.86881H3.75ZM3.88465 7.73787C4.00381 7.37733 4.1986 7.04639 4.45599 6.76721L2.98551 5.41158C2.5351 5.90016 2.19422 6.4793 1.98568 7.11025L3.88465 7.73787ZM4.45603 6.76716C4.72086 6.47985 5.09526 6.25801 6.25356 5.61408L5.28178 3.86604C4.24374 4.44311 3.51997 4.83177 2.98547 5.41163L4.45603 6.76716ZM8.64323 4.28689C9.73482 3.68045 10.0998 3.49004 10.4636 3.41487L10.0588 1.45626C9.32484 1.60794 8.65059 1.99488 7.67195 2.53858L8.64323 4.28689ZM10.4627 3.41505C10.8172 3.34212 11.1828 3.34212 11.5373 3.41505L11.9403 1.45607C11.3199 1.32844 10.6801 1.32844 10.0597 1.45607L10.4627 3.41505ZM11.5364 3.41487C11.9002 3.49004 12.2652 3.68045 13.3568 4.28689L14.328 2.53857C13.3494 1.99488 12.6752 1.60793 11.9412 1.45626L11.5364 3.41487ZM6.51164 11.7071L9.03248 14.2279L10.4467 12.8137L7.92586 10.2929L6.51164 11.7071ZM10.4467 14.2279L15.4884 9.18625L14.0741 7.77204L9.03248 12.8137L10.4467 14.2279ZM13.3569 4.28695L15.7468 5.61428L16.7179 3.86584L14.3279 2.53851L13.3569 4.28695ZM15.7468 16.3857L13.3569 17.713L14.3279 19.4615L16.7179 18.1341L15.7468 16.3857ZM8.64313 17.713L6.2532 16.3857L5.28214 18.1341L7.67208 19.4615L8.64313 17.713ZM6.2532 5.61428L8.64312 4.28695L7.67206 2.53851L5.28214 3.86584L6.2532 5.61428Z"
      fill="currentColor"
    />
  </svg>
)

/**
 * Canonical Human Points glyph, ported from the design-system icon set
 * (human-tech-design-system/src/icons/humanpoints.svg) — the same mark used
 * for the points chip in the SiteTopBar stories. Inlined as raw SVG for the
 * same reason as VerifiedIcon above.
 */
const HumanPointsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M50.5 10C54.0539 10 57.136 11.6347 59.5978 13.9768C62.0389 16.2999 64.0561 19.472 65.6595 23.0796C66.8788 25.8231 67.9004 28.9244 68.7057 32.2892C72.0727 33.0947 75.1753 34.1205 77.9204 35.3405C81.5277 36.9437 84.7001 38.9614 87.0232 41.4022C89.3651 43.8637 90.9997 46.9466 91 50.5C90.9997 54.0537 89.3654 57.1362 87.0232 59.5978C84.7003 62.0387 81.5276 64.0511 77.9204 65.6544C75.1754 66.8744 72.0725 67.8993 68.7057 68.7057C67.9002 72.0724 66.8794 75.1756 65.6595 77.9204C64.0561 81.528 62.0389 84.7001 59.5978 87.0232C57.136 89.3653 54.0539 91 50.5 91C46.946 90.9996 43.8639 89.3657 41.4022 87.0232C38.9612 84.7002 36.9489 81.5278 35.3456 77.9204C34.1254 75.1751 33.0957 72.0731 32.2892 68.7057C28.9242 67.8995 25.8232 66.8738 23.0796 65.6544C19.4724 64.0511 16.2997 62.0387 13.9768 59.5978C11.6346 57.1362 10.0003 54.0537 10 50.5C10.0003 46.9466 11.6349 43.8637 13.9768 41.4022C16.2999 38.9614 19.4723 36.9437 23.0796 35.3405C25.8233 34.1211 28.924 33.0945 32.2892 32.2892C33.0955 28.9237 34.126 25.8236 35.3456 23.0796C36.9489 19.4722 38.9612 16.2998 41.4022 13.9768C43.8639 11.6343 46.946 10.0003 50.5 10ZM59.8876 70.2313C56.8657 70.57 53.7207 70.75 50.5 70.75C47.2775 70.75 44.1307 70.5703 41.1073 70.2313C41.6021 71.8156 42.1484 73.2882 42.7448 74.6301C44.0732 77.619 45.5506 79.7887 46.986 81.1547C48.3999 82.5003 49.5812 82.9037 50.5 82.9041C51.4188 82.9041 52.6 82.4999 54.014 81.1547C55.4494 79.7887 56.9268 77.619 58.2552 74.6301C58.8514 73.2887 59.3925 71.815 59.8876 70.2313ZM50.5 38.3459C46.5082 38.3459 42.7086 38.6605 39.2003 39.2003C38.6615 42.7086 38.351 46.5085 38.351 50.5C38.351 54.4896 38.662 58.2877 39.2003 61.7946C42.7089 62.3335 46.5081 62.649 50.5 62.649C54.49 62.649 58.2874 62.333 61.7946 61.7946C62.334 58.2874 62.6541 54.4902 62.6541 50.5C62.6541 46.5079 62.3345 42.7089 61.7946 39.2003C58.2877 38.661 54.4899 38.3459 50.5 38.3459ZM30.7636 41.1073C29.1812 41.6021 27.7104 42.149 26.3699 42.7448C23.3813 44.073 21.2113 45.5508 19.8453 46.986C18.5006 48.3994 18.0963 49.5814 18.0959 50.5C18.0963 51.4187 18.5002 52.6003 19.8453 54.014C21.2112 55.4493 23.3812 56.9269 26.3699 58.2552C27.7104 58.8509 29.1812 59.3983 30.7636 59.8927C30.4246 56.8695 30.25 53.7222 30.25 50.5C30.25 47.2778 30.4246 44.1305 30.7636 41.1073ZM70.2313 41.1073C70.5697 44.1308 70.75 47.2776 70.75 50.5C70.75 53.7224 70.5697 56.8692 70.2313 59.8927C71.8155 59.3979 73.2883 58.8515 74.6301 58.2552C77.6188 56.9269 79.7888 55.4493 81.1547 54.014C82.4998 52.6003 82.9037 51.4187 82.9041 50.5C82.9037 49.5814 82.4994 48.3994 81.1547 46.986C79.7887 45.5508 77.6186 44.073 74.6301 42.7448C73.2883 42.1484 71.8155 41.6025 70.2313 41.1073ZM50.5 18.0959C49.5812 18.0963 48.3999 18.4997 46.986 19.8453C45.5506 21.2113 44.0732 23.381 42.7448 26.3699C42.149 27.7104 41.6018 29.1811 41.1073 30.7636C44.1306 30.4253 47.2778 30.25 50.5 30.25C53.7204 30.25 56.8659 30.4256 59.8876 30.7636C59.3929 29.1817 58.8508 27.71 58.2552 26.3699C56.9268 23.3809 55.4494 21.2113 54.014 19.8453C52.6 18.5001 51.4188 18.0959 50.5 18.0959Z"
      fill="currentColor"
    />
  </svg>
)

type WalletDisplayProps = {
  address?: string
  displayName?: string | null
  isConnected: boolean
  walletIcon: string
  networkIcon?: string
  balance?: string
  onDisconnect?: () => void
  availableAccounts?: Array<{ alias: string; address: string; index?: number }>
  onSelectAccount?: (account: { alias: string; address: string; index?: number }) => void
  walletType: WalletType
  loginMethod?: string | null
  /**
   * L2 account the SERVER has disclosed as the pair for the connected EVM wallet
   * (from the authoritative conflict/bound response — never localStorage). When
   * an account in the Switch Account list matches it, that row is marked "Linked
   * to your EVM wallet 0x…" so the user can pick it. Undefined when nothing is
   * disclosed yet — the list shows no "linked" badge rather than guessing.
   */
  linkedAccountAddress?: string
  /** Connected EVM address, used only to label the linked row ("…EVM wallet 0x…"). */
  linkedEvmAddress?: string
  /**
   * True when this row lives inside the merged wallet-cluster pill (see
   * walletCluster in Header) — drops its own rounded/border/shadow/blur so
   * the row reads as a flat strip and the *cluster's* single outer pill
   * supplies the glass-pill material, instead of stacking a second
   * independently-rounded pill on top of it.
   */
  flat?: boolean
  /**
   * Which outer corners this flat row owns, matching the cluster's own
   * rounded-[20px] shape (top row rounds its top corners, bottom row its
   * bottom corners). Without this the row's hover/active background is a
   * plain rectangle whose square corner pokes past the cluster's curve —
   * a flush-edge mismatch at the pill's outer corner (issue #72).
   */
  roundedEdge?: 'top' | 'bottom'
  /** True when Privacy Mode is on and the page is on the dark background. */
  isDark?: boolean
  /**
   * Hard-lock the fund-losing actions in this row's dropdown (Disconnect +
   * Switch Account) while a transfer is in progress (issue #136). Copy Address /
   * Open Wallet stay enabled — they can't orphan the transfer.
   */
  actionsLocked?: boolean
}

/** Shown on the locked Disconnect / Switch-Account rows during a transfer. */
const TRANSFER_LOCK_HINT = 'Locked during transfer to protect your funds.'

function truncateAddr(addr: string): string {
  if (addr.length <= 13) return addr
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
}

/**
 * One wallet pill in the CONNECTED state: truncated address (or alias) +
 * dropdown for copy address / open wallet / switch account / disconnect.
 * Renders null when not connected — see WalletConnectPill for that state.
 */
const WalletDisplay: React.FC<WalletDisplayProps> = ({
  address,
  displayName,
  isConnected,
  walletIcon,
  networkIcon,
  balance,
  onDisconnect,
  availableAccounts,
  onSelectAccount,
  walletType,
  loginMethod,
  linkedAccountAddress,
  linkedEvmAddress,
  flat,
  roundedEdge,
  isDark = false,
  actionsLocked = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowDropdown(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleClick = () => {
    setShowDropdown(!showDropdown)
  }

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setShowDropdown(false)
      }, 2000)
    }
  }

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect()
    }
    setShowDropdown(false)
  }

  const handleOpenWallet = () => {
    window.open(silkUrl, '_blank', 'noopener,noreferrer')
    setShowDropdown(false)
  }

  if (!isConnected) return null

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className={
          flat
            ? `flex items-center gap-1.5 sm:gap-2 pr-3.5 sm:pr-4 pl-2.5 py-1 h-8 w-full cursor-pointer transition-colors duration-200 ${
                roundedEdge === 'top' ? 'rounded-t-[20px]' : roundedEdge === 'bottom' ? 'rounded-b-[20px]' : ''
              } ${showDropdown ? activeTint(isDark) : hoverTint(isDark)}`
            : `flex items-center gap-1.5 pr-2 pl-1 py-1 h-8 w-full rounded-full ${glassPill(isDark, showDropdown)} cursor-pointer`
        }
        onClick={handleClick}
        aria-haspopup="true"
        aria-expanded={showDropdown}
      >
        <span className="flex w-6 h-6 p-[2px] justify-center items-center rounded-full bg-[#FDE7F3] flex-shrink-0">
          <Image src={walletIcon} alt="" width={20} height={20} />
        </span>
        {networkIcon && <Image src={networkIcon} alt="" width={14} height={14} className="flex-shrink-0" />}
        {/* min-w-0 lets this block shrink/truncate instead of pushing the
            caret out — the caret gets its own guaranteed room via the
            row's pr-4 + gap, not by squeezing against the text (see #72
            follow-up: caret was crowded against the address/balance). */}
        <span className="flex flex-col items-start leading-tight min-w-0 flex-1">
          <span className={`text-xs font-medium ${navText(isDark)} truncate max-w-full`} title={address || ''}>
            {displayName || (address ? truncateAddr(address) : '')}
          </span>
          {balance && walletType === WalletType.WAAP && (
            <span className={`text-[9px] ${subtleText(isDark)} leading-none truncate max-w-full`}>{balance} ETH</span>
          )}
        </span>
        <Icon
          icon="ph:caret-down"
          width={12}
          height={12}
          className={`ml-auto flex-shrink-0 ${mutedIconText(isDark)} transition-transform duration-150 ${showDropdown ? 'rotate-180' : ''}`}
        />
      </button>

      {showDropdown && (
        <div className={`absolute right-0 mt-2 shadow-lg z-50 min-w-[190px] py-2 rounded-[16px] ${panelSurface(isDark)} ${navText(isDark)}`}>
          <div
            className={`flex items-center gap-2 px-4 py-2 ${menuItemHover(isDark)} cursor-pointer relative transition-colors duration-150`}
            onClick={handleCopyAddress}
          >
            <Icon icon="ph:copy" width={20} height={20} />
            <span>{copied ? 'Copied!' : 'Copy Address'}</span>
          </div>

          {loginMethod === LOGIN_METHODS.WAAP && (
            <div
              className={`flex items-center gap-2 px-4 py-2 ${menuItemHover(isDark)} cursor-pointer relative transition-colors duration-150`}
              onClick={handleOpenWallet}
            >
              <Icon icon="majesticons:open" width={20} height={20} />
              <span>Open Wallet</span>
            </div>
          )}

          {availableAccounts && availableAccounts.length > 1 && onSelectAccount && (
            <>
              <div className={`border-t ${panelDivider(isDark)} my-1`} />
              <div className="px-4 py-1">
                <span className={`text-xs ${mutedIconText(isDark)} font-medium`}>Switch Account</span>
              </div>
              {/* #136: switching the Aztec account mid-transfer would re-point
                  the flow at a different L2 recipient and orphan the in-flight
                  claim, so the switch rows are hard-disabled (not merely
                  confirm-gated) until the transfer settles. */}
              {actionsLocked && (
                <p className={`px-4 pb-1 text-[10px] leading-snug ${subtleText(isDark)}`}>{TRANSFER_LOCK_HINT}</p>
              )}
              {/* Current account indicator — the dropdown intentionally hides the
                  active account from the switch list (you can't switch to what
                  you're already on), so this non-interactive row keeps it visible
                  and labelled "Current" so users aren't confused that one account
                  appears to be "missing". Never rendered as a switchable row, so
                  there's no duplicate. */}
              {(() => {
                const current = availableAccounts.find((a) => a.address === address)
                const currentLabel = displayName || (current ? accountLabel(current) : address ? truncateAddr(address) : '')
                return (
                  <div className="flex items-center gap-2 px-4 py-2 cursor-default">
                    <Icon icon="ph:check" width={18} height={18} className={accentPink(isDark)} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{currentLabel}</span>
                      <span className={`text-xs ${mutedIconText(isDark)}`}>
                        {address ? truncateAddr(address) : ''} · Current
                      </span>
                    </div>
                  </div>
                )
              })()}
              {availableAccounts
                .filter((acc) => acc.address !== address)
                .map((acc, i) => {
                  const isLinked =
                    !!linkedAccountAddress && acc.address.toLowerCase() === linkedAccountAddress.toLowerCase()
                  return (
                    <div
                      key={acc.address}
                      className={`flex items-center gap-2 px-4 py-2 transition-colors duration-150 ${
                        actionsLocked ? 'opacity-50 cursor-not-allowed' : `${menuItemHover(isDark)} cursor-pointer`
                      }`}
                      aria-disabled={actionsLocked}
                      title={actionsLocked ? TRANSFER_LOCK_HINT : undefined}
                      onClick={() => {
                        if (actionsLocked) return
                        onSelectAccount(acc)
                        setShowDropdown(false)
                      }}
                    >
                      <Icon icon="ph:wallet" width={18} height={18} className={subtleText(isDark)} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm truncate">{accountLabel(acc, i)}</span>
                        <span className={`text-xs ${mutedIconText(isDark)}`}>{truncateAddr(acc.address)}</span>
                      </div>
                      {isLinked && (
                        <span
                          className={`ml-auto flex items-center gap-1 text-[10px] font-medium whitespace-nowrap ${accentPink(isDark)}`}
                          title={
                            linkedEvmAddress
                              ? `Linked to your EVM wallet ${shortAddr(linkedEvmAddress)}`
                              : 'Linked to your EVM wallet'
                          }
                        >
                          <Icon icon="ph:link-simple" width={14} height={14} className="flex-shrink-0" />
                          {linkedEvmAddress ? `Linked ${shortAddr(linkedEvmAddress)}` : 'Linked'}
                        </span>
                      )}
                    </div>
                  )
                })}
              <div className={`border-t ${panelDivider(isDark)} my-1`} />
            </>
          )}

          {/* #136: disconnecting mid-transfer tears down the wallet session the
              live /progress view depends on, orphaning the transfer's recovery
              data — so this is hard-disabled during an active transfer rather
              than confirm-gated. */}
          <div
            className={`flex items-center gap-2 px-4 py-2 transition-colors duration-150 ${
              actionsLocked ? 'opacity-50 cursor-not-allowed' : `${menuItemHover(isDark)} cursor-pointer`
            } ${
              // NOTE: `text-red-500` never resolved here — this app's tailwind.config.js
              // replaces (not extends) the default palette, which drops the red-500/
              // gray-300/400/500 numbered scales, so `text-red-500` silently compiles to
              // no rule and this row inherits its color from the dropdown panel instead
              // (harmless in light mode — that inherited navy still reads fine — but
              // would've inherited near-white in dark mode with no "danger" cue left).
              // Pre-existing bug; left as-is for light so that mode stays byte-identical,
              // fixed only for dark where an unstyled Disconnect loses its meaning.
              isDark ? 'text-[#FF6B6B]' : 'text-red-500'
            }`}
            aria-disabled={actionsLocked}
            title={actionsLocked ? TRANSFER_LOCK_HINT : undefined}
            onClick={actionsLocked ? undefined : handleDisconnect}
          >
            <Icon icon="ph:sign-out" width={20} height={20} />
            <span>Disconnect</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface WalletConnectPillProps {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  /** See WalletDisplayProps.flat — same "flat row inside the merged cluster pill" treatment. */
  flat?: boolean
  /** See WalletDisplayProps.roundedEdge. */
  roundedEdge?: 'top' | 'bottom'
  /** True when Privacy Mode is on and the page is on the dark background. */
  isDark?: boolean
}

/**
 * One wallet pill in the NOT-CONNECTED state, used inside the merged
 * cluster once the *other* chain has already connected (see walletCluster
 * in Header below). Compact — same footprint as the connected WalletDisplay
 * pill so the cluster doesn't jump in width when a chain connects/disconnects.
 */
const WalletConnectPill: React.FC<WalletConnectPillProps> = ({
  icon,
  label,
  onClick,
  disabled,
  title,
  flat,
  roundedEdge,
  isDark = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={
      flat
        ? `flex items-center gap-1.5 sm:gap-2 pr-2.5 sm:pr-3.5 pl-2.5 py-1 h-8 w-full transition-colors duration-200 ${
            roundedEdge === 'top' ? 'rounded-t-[20px]' : roundedEdge === 'bottom' ? 'rounded-b-[20px]' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : `${hoverTint(isDark)} cursor-pointer`}`
        : `flex items-center gap-1.5 pr-2.5 pl-1 py-1 h-8 w-full rounded-full ${isDark ? GLASS_PILL_DARK : GLASS_PILL} ${
            disabled ? 'opacity-50 cursor-not-allowed' : `${isDark ? GLASS_PILL_DARK_HOVER : GLASS_PILL_HOVER} cursor-pointer`
          }`
    }
  >
    <span className="flex w-6 h-6 items-center justify-center rounded-full bg-latest-grey-300 flex-shrink-0">
      <Image src={icon} alt="" width={15} height={15} />
    </span>
    <span className={`text-xs font-medium ${navText(isDark)} truncate`}>{label}</span>
  </button>
)

/**
 * Single combined "Connect Wallet" pill shown when NEITHER chain is
 * connected — normal nav-row height (matches Privacy Mode / the humanity
 * chip), so the nav never has to reserve the taller two-pill stack's height
 * up front. Starts the existing combined WaaP→Aztec connect flow. Once the
 * first leg connects, the cluster switches to the stacked per-chain pills
 * (see walletCluster in Header).
 */
const ConnectWalletPill: React.FC<{ onClick: () => void; connecting?: boolean; isDark?: boolean }> = ({
  onClick,
  connecting,
  isDark = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={connecting}
    title={connecting ? 'Connecting…' : 'Connect Wallet'}
    aria-label={connecting ? 'Connecting wallet' : 'Connect wallet'}
    className={`flex items-center justify-center gap-2 h-9 sm:h-10 w-9 sm:w-auto px-0 sm:px-4 rounded-full ${isDark ? GLASS_PILL_DARK : GLASS_PILL} flex-shrink-0 ${
      connecting ? 'opacity-60 cursor-not-allowed' : `${isDark ? GLASS_PILL_DARK_HOVER : GLASS_PILL_HOVER} cursor-pointer`
    }`}
  >
    <Icon icon="ph:wallet-fill" width={16} height={16} className={`${accentPink(isDark)} flex-shrink-0`} />
    {/* Text collapses first on narrow widths — icon-only affordance below
        `sm`, same collapse pattern as the Privacy Mode label — so this
        pill can never push the hamburger toggle out past the nav edge. */}
    <span className={`hidden sm:inline text-xs sm:text-sm font-medium ${navText(isDark)} whitespace-nowrap`}>
      {connecting ? 'Connecting…' : 'Connect Wallet'}
    </span>
  </button>
)

interface HumanityPointsChipProps {
  /** L1-only proof-of-personhood result from useL1Humanity — 'poch' | 'passport' | null. */
  method: 'poch' | 'passport' | null
  passportScore?: number
  passportThreshold?: number
  /** True while the attestation query is in flight (or hasn't resolved yet). */
  isFetching: boolean
  points: number
  /** True when Privacy Mode is on and the page is on the dark background. */
  isDark?: boolean
  /**
   * Copy shown in the expanded panel when NOT verified. Varies by connection
   * state (see Header): prompt to connect the EVM wallet when nothing is
   * connected, or the eligibility reason once a wallet is connected.
   */
  unverifiedHint?: string
}

/**
 * Collapsible Humanity Score + Points indicator. Collapsed = compact chip
 * (score · points); click/tap expands a small panel with the score bar and
 * points detail. Closes on click-outside or Escape.
 *
 * Humanity side reflects the L1-only proof-of-personhood result from
 * useL1Humanity (see Header below) — it is independent of the L1↔L2 binding and
 * never shows a binding-conflict message:
 *  - method === 'passport' → the real cumulative numeric passportScore (shown as
 *    a bare number, not a fraction).
 *  - method === 'poch' → Proof of Clean Hands has no numeric score, so this
 *    shows a "Verified" state instead of a fabricated number.
 *  - no data yet / still loading / method === null / wallets not connected →
 *    a dimmed neutral "—", never a fake score.
 */
const HumanityPointsChip: React.FC<HumanityPointsChipProps> = ({
  method,
  passportScore,
  passportThreshold,
  isFetching,
  points,
  isDark = false,
  unverifiedHint = 'Connect your Ethereum wallet to verify personhood.',
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
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

  const isPassport = method === 'passport' && typeof passportScore === 'number'
  const isPoch = method === 'poch'
  const isVerified = isPassport || isPoch
  const scoreLabel = isPassport ? String(passportScore) : isPoch ? 'Verified' : '—'
  const scorePct = isPassport
    ? Math.min(100, Math.max(0, (passportScore! / (passportThreshold || passportScore!)) * 100))
    : isPoch
      ? 100
      : 0

  return (
    <div className="relative" ref={ref}>
      {/* Vertical chip (#111): humanity score stacked ABOVE points, so the chip
          reads as a compact two-line stat pill sitting flush beside the wallet/
          account stack (its ~two-row height pairs with the stacked wallet
          cluster) instead of a wide horizontal strip. Click still opens the same
          expandable panel below. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`flex items-center gap-1.5 sm:gap-2 h-14 sm:h-16 px-2.5 sm:px-3 rounded-[18px] transition-colors duration-200 ${open ? activeTint(isDark) : hoverTint(isDark)} cursor-pointer`}
      >
        <div className="flex flex-col justify-center gap-1.5">
          {/* Humanity row. The green pulsing glow (ported DS chip--glow) is a
              halo around this badge — applied ONLY in the verified/green state,
              mirroring the DS which only glows the green verified chip. The
              wrapper is a tight rounded container so the box-shadow reads as a
              circular halo around the bare icon. */}
          <span className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center rounded-full ${isVerified ? 'humanity-glow' : ''}`}>
              <VerifiedIcon className={`w-3.5 h-3.5 ${isVerified ? accentPink(isDark) : isDark ? 'text-white/[0.25]' : 'text-gray-300'}`} />
            </span>
            <span className={`text-xs font-semibold leading-none ${isVerified ? accentPink(isDark) : mutedIconText(isDark)}`}>{scoreLabel}</span>
          </span>
          {/* Points row — HUMN Points glyph with slow continuous rotation (ported DS chip--spin-icon). */}
          <span
            className="flex items-center gap-1.5"
            title="HUMN Points — rewards for verified humans, not bots, across human.tech. Open for details."
          >
            <HumanPointsIcon className={`w-3.5 h-3.5 ${navText(isDark)} humn-points-spin`} />
            <span className={`text-xs font-semibold leading-none ${navText(isDark)}`}>{points.toLocaleString()}</span>
          </span>
        </div>
        <Icon
          icon="ph:caret-down"
          width={11}
          height={11}
          className={`${mutedIconText(isDark)} transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 z-50 w-[248px] rounded-2xl ${panelSurface(isDark)} shadow-lg p-4 flex flex-col gap-3`}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`flex items-center gap-1 text-xs font-medium ${subtleText(isDark)}`}>
                Humanity
                <span
                  className="inline-flex cursor-help"
                  data-tooltip-id="humanity-info-tooltip"
                  aria-label="What is the humanity score?"
                >
                  <Icon icon="ph:info" width={13} height={13} className={mutedIconText(isDark)} />
                </span>
              </span>
              {/* Cumulative score — NOT a fraction, so no "/threshold" denominator (#112/#113). */}
              <span className={`text-sm font-semibold ${isVerified ? accentPink(isDark) : mutedIconText(isDark)}`}>
                {isPassport
                  ? String(passportScore)
                  : isPoch
                    ? 'Verified'
                    : isFetching
                      ? 'Checking…'
                      : 'Not verified'}
              </span>
            </div>
            <ReactTooltip
              id="humanity-info-tooltip"
              place="top"
              clickable
              className="z-[100] max-w-[220px]"
              style={{ fontSize: '11px', padding: '6px 8px' }}
              render={() => (
                <span>
                  A cumulative proof-of-personhood score — higher means stronger proof you&apos;re a real, unique human. From Proof of Clean Hands and{' '}
                  <a
                    href="https://app.passport.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Human Passport
                  </a>
                  .
                </span>
              )}
            />
            <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-white/[0.10]' : 'bg-[#F5E1EA]'} overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  isVerified ? (isDark ? 'bg-[#FA8FC4]' : 'bg-[#81133B]') : isDark ? 'bg-white/[0.25]' : 'bg-gray-300'
                }`}
                style={{ width: `${scorePct}%` }}
              />
            </div>
            {isPoch && (
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 cursor-help"
                  data-tooltip-id="poch-info-tooltip"
                  aria-label="About Proof of Clean Hands"
                >
                  {/* Proof of Clean Hands badge (#127/#128). The L1 humanity
                      result only tells us POCH is satisfied (method === 'poch');
                      it carries NO mint date or expiry — checkCleanHands (the
                      /attestation/sbts/clean-hands endpoint) returns only
                      { isUnique, signature?, circuitId? } and L1EligibilityResult
                      has no temporal fields. So this shows the PoCH mark + an
                      explanatory tooltip, not fabricated dates.
                      TODO(poch-meta): surface actual mint/expiry by fetching the
                      Clean-Hands SBT / attestation metadata (a new data path —
                      not exposed by the current eligibility route). */}
                  <Icon icon="ph:hand-soap" width={15} height={15} className={accentPink(isDark)} />
                  <span className={`text-[11px] font-medium ${accentPink(isDark)}`}>Proof of Clean Hands</span>
                  <Icon icon="ph:info" width={12} height={12} className={mutedIconText(isDark)} />
                </span>
                <ReactTooltip
                  id="poch-info-tooltip"
                  place="top"
                  clickable
                  className="z-[100] max-w-[240px]"
                  style={{ fontSize: '11px', padding: '6px 8px' }}
                  render={() => (
                    <span>
                      <strong>Proof of Clean Hands</strong> — a privacy-preserving proof you&apos;re a real, sanctions-screened human. No numeric score needed. Mint date and expiry aren&apos;t available in this view yet.{' '}
                      <a
                        href={POCH_MINT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        Manage
                      </a>
                    </span>
                  )}
                />
              </div>
            )}
            {!isVerified && (
              <p className={`text-[11px] ${subtleText(isDark)} mt-1.5`}>
                {isFetching ? 'Checking eligibility…' : unverifiedHint}
              </p>
            )}
          </div>
          <div className={`flex flex-col gap-2 pt-2 border-t ${panelDivider(isDark)}`}>
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 text-xs font-medium ${subtleText(isDark)}`}>
                <HumanPointsIcon className="w-3.5 h-3.5" />
                HUMN Points
              </span>
              <span className={`text-sm font-semibold ${navText(isDark)}`}>{points.toLocaleString()}</span>
            </div>
            {/* TODO: `points` is still the PLACEHOLDER_POINTS stub — Shield has no
                per-user points source yet. The real value must be fetched from the
                points backend (the passport/Covenant HUMN Points service) and
                threaded through the `points` prop. Do NOT fabricate a per-action
                breakdown here — show only the real single balance once it's wired. */}
            <p className={`text-[11px] leading-snug ${subtleText(isDark)}`}>
              HUMN Points reward real, verified humans — not bots — across human.tech.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

interface HeaderProps {
  credentials?: React.ReactNode
  /** Live points balance. Defaults to a stubbed placeholder — see PLACEHOLDER_POINTS. */
  points?: number
}

const Header: React.FC<HeaderProps> = ({ credentials, points = PLACEHOLDER_POINTS }) => {
  const {
    waapAddress,
    isWaapConnected,
    connectWaapWallet,
    disconnectWaapWallet,
    aztecAddress,
    isAztecConnected,
    disconnectAztecWallet,
    connectAztecWallet,
    walletConnectionPhase,
    waapLoginMethod: loginMethod,
    waapWalletIcon: walletIcon,
    aztecAlias,
    availableAccounts,
    switchAztecAccount,
  } = useWalletStore()

  // Humanity is an L1-ONLY property of the EVM wallet (issue #122) — it has
  // NOTHING to do with the L1↔L2 binding. Sourced purely from useL1Humanity so
  // the Humanity chip can never surface a binding-conflict message; binding
  // problems live only in the wallet-cluster notice/toast below. Self-gates on
  // `waapAddress`, so it's a no-op until the EVM wallet connects.
  const { data: l1Humanity, isFetching: isL1HumanityFetching } = useL1Humanity(waapAddress || undefined)

  // Authoritative binding for the connected pair (needs both wallets + JWT).
  const { data: bindingStatus } = useBindingStatus()

  const humanitySource = {
    method: l1Humanity?.method ?? null,
    passportScore: l1Humanity?.passportScore,
    passportThreshold: l1Humanity?.passportThreshold,
    isFetching: isL1HumanityFetching,
    reason: l1Humanity?.reason,
  }

  const unverifiedHint = !isWaapConnected
    ? 'Connect your Ethereum wallet to verify personhood.'
    : humanitySource.reason
      ? humanitySource.reason
      : 'This wallet has not verified its humanity yet.'

  // ─── Pairing / binding conflict (issues #98, #97, #100, #120, #124) ──
  // SERVER TRUTH ONLY. On a server-side conflict, describeConflict names the
  // exact stored counterpart from the CURRENT pair's response (privacy-safe).
  // When the connected pair matches the stored binding the status is 'bound',
  // describeConflict returns null, and every notice/toast below clears — the
  // conflict UI is derived entirely from this live status, so it can't go stale.
  const conflict = describeConflict(bindingStatus?.binding, waapAddress, aztecAddress)

  // The Aztec account the SERVER says this EVM wallet is bound to (disclosed on
  // an evm-linked-elsewhere conflict). Live off the CURRENT response — used for
  // the inline conflict notice so it clears the instant the pair matches.
  const serverLinkedL2 = disclosedLinkedL2(conflict)

  // Persistent (session) view of the linked Aztec account for the connected EVM
  // wallet — remembered from any earlier server disclosure this session (bound
  // or conflict), so the "Linked" badge on the Switch Account list survives a
  // dropdown reopen even after the transient conflict response has cleared. In
  // memory only (never localStorage); null until something has been disclosed.
  const sessionLinkedL2 = useSessionLinkedL2(waapAddress)

  // Is that server-disclosed linked account one of the Azguard accounts the user
  // already has connected? Used only to tune the inline notice copy.
  const linkedAccountConnected =
    !!serverLinkedL2 && availableAccounts.some((a) => a.address.toLowerCase() === serverLinkedL2.toLowerCase())

  const walletNotice = !conflict
    ? null
    : serverLinkedL2 && !linkedAccountConnected
      ? `Your EVM wallet is linked to Aztec account ${shortAddr(serverLinkedL2)} — select/connect that account to continue.`
      : conflictMessage(conflict)

  const { isPrivacyModeEnabled, setPrivacyModeEnabled, getProgressSteps } = useBridgeStore()

  // In-progress transfer detection — same derivation BridgeHeader uses: at
  // least one active step, not all completed, and not errored. While true, the
  // wallet Disconnect + Switch Account are HARD-DISABLED (issue #136 — they'd
  // orphan the live transfer's recovery data), and the brand-link-to-home still
  // confirms before tearing down the /progress view. Idle, completed and errored
  // flows navigate/disconnect freely.
  const progressSteps = getProgressSteps()
  const isTransferInProgress =
    progressSteps.some((s) => s.status === 'active') &&
    !progressSteps.every((s) => s.status === 'completed') &&
    !progressSteps.some((s) => s.status === 'error')

  const { splashActive, requestShowSplash } = useOnboardingStore()

  // Privacy Mode swaps the page to the deep-maroon background (see
  // ClientLayout's `showPrivacyBackground`) — the nav's light glass-pill
  // material reads poorly there, so every pill/text/hover style below is
  // gated on this same flag to switch to its dark-mode counterpart.
  //
  // Exception: while the onboarding splash is up, the nav is lifted ABOVE that
  // overlay onto the splash's LIGHT paper field (the dark background is hidden
  // behind the splash). Rendering the dark nav there is white-on-light-pink and
  // unreadable, so stay light-styled until the splash dismisses (#94).
  const isDark = isPrivacyModeEnabled && !splashActive
  const { openModal: openHowItWorks } = useExplainerStore()
  const notify = useToast()

  // The docs pages are a standalone reading view — no wallet, privacy toggle, or
  // deployment badge.
  const pathname = usePathname()
  const isDocs = pathname?.startsWith('/docs') ?? false

  const { data: l1TokenBalances = [] } = useL1TokenBalances()

  const sepoliaNativeTokens = l1TokenBalances.find(
    (t) => t.type === 'native' && t.network?.chainId === L1_CHAIN_ID,
  )
  const l1NativeBalance = sepoliaNativeTokens?.balance_formatted?.toString()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [walletButtonPressed, setWalletButtonPressed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setMounted(true)
  }, [])

  // No forced auto-switch (reverted #120): selecting a "wrong" Aztec account is
  // allowed and never silently overridden — the app must never change the user's
  // chosen account for them. Instead the linked account is MARKED in the switch
  // list (see linkedAccountAddress below) and the primary action button is
  // guarded up-front in page.tsx when the connected pair is a conflict, so a
  // guaranteed-to-fail bridge can't be started. The conflict is surfaced inline
  // under the wallet cluster (walletNotice) — no toast.

  // Auto-connect to Aztec when WaaP wallet is connected
  useEffect(() => {
    if (isWaapConnected && !isAztecConnected && walletButtonPressed && walletConnectionPhase === 'idle') {
      const timer = setTimeout(() => {
        connectAztecWallet()
        setWalletButtonPressed(false)
      }, AZTEC_AUTO_CONNECT_DELAY_MS)

      return () => clearTimeout(timer)
    }
  }, [isWaapConnected, isAztecConnected, walletButtonPressed, walletConnectionPhase, connectAztecWallet])

  // Close the secondary-nav (mobile) panel on click-outside / Escape
  useEffect(() => {
    if (!mobileMenuOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const handleConnectWallet = async () => {
    // Set the button pressed flag
    setWalletButtonPressed(true)
    try {
      await connectWaapWallet()
      // Aztec connection will be handled by the useEffect above
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      // Reset the button press tracker if connection fails
      setWalletButtonPressed(false)
    }
    setMobileMenuOpen(false)
  }

  const handleConnectAztecOnly = async () => {
    try {
      await connectAztecWallet()
    } catch (error) {
      console.error('Failed to connect Aztec wallet:', error)
    }
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const isL1Connecting = !isWaapConnected && walletConnectionPhase !== 'idle'
  const isL2Connecting = isWaapConnected && !isAztecConnected && (walletButtonPressed || walletConnectionPhase !== 'idle')

  if (!mounted) {
    return (
      <header className="w-full px-4 pt-3 flex justify-between items-center">
        <div className="flex-shrink-0">
          <Link href="/" className="hover:opacity-80 transition-opacity duration-200">
            <Image src="/assets/svg/shield-lockup-maroon.svg" alt="Shield" width={112} height={30} />
          </Link>
        </div>
      </header>
    )
  }

  if (isDocs) {
    return (
      <header className="w-full px-4 pt-3 flex justify-between items-center relative">
        <div className="flex-shrink-0">
          <Link href="/" className="hover:opacity-80 transition-opacity duration-200">
            <Image src="/assets/svg/shield-lockup-maroon.svg" alt="Shield" width={112} height={30} />
          </Link>
        </div>
      </header>
    )
  }

  const privacyToggle = (
    // Flat segment, not a pill (#185). Carries no glass-pill fill/shadow/blur of
    // its own so it doesn't read as a pill stacked on the main nav pill. The
    // toggle switch itself supplies the interactive affordance, and a hairline on
    // the wrapper (see below) divides it from the centered nav links.
    <div
      className={`flex items-center gap-[6px] sm:gap-[8px] h-9 sm:h-10 privacy-mode-toggle relative flex-shrink-0`}
      data-tooltip-id="privacy-mode-tooltip"
      data-tooltip-content={isPrivacyModeEnabled ? 'Private transactions enabled' : 'Enable private transactions'}
    >
      <span
        className={`hidden sm:inline ${isDark ? 'text-white/[0.90]' : 'text-[#0A0A0A]'} text-[13px] font-[450] leading-[20px] font-sans whitespace-nowrap`}
      >
        Privacy Mode
      </span>
      <button
        className={`flex w-[36px] h-[22px] sm:w-[40px] sm:h-[24px] py-[3px] px-1 items-center rounded-[8px] transition-all duration-200 border-0 focus:outline-none relative z-10 flex-shrink-0 ${
          isPrivacyModeEnabled ? 'bg-[#3B3B3B] justify-end pl-[17px] sm:pl-[19px]' : 'bg-[#D4D4D4] justify-start pr-[17px] sm:pr-[19px]'
        }`}
        onClick={() => {
          setPrivacyModeEnabled(!isPrivacyModeEnabled)
          if (!isPrivacyModeEnabled) {
            setTimeout(() => {
              notify('privacy-mode', {
                message: 'Your balance, counterparties, and history stay private on Aztec',
                heading: 'Private mode activated',
              })
            }, 1500)
          } else {
            notify.dismiss('privacy-mode-toastId')
          }
        }}
        aria-pressed={isPrivacyModeEnabled}
        tabIndex={0}
        style={{ border: 'none' }}
      >
        <span className="flex w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] p-[1px] justify-center items-center flex-shrink-0 rounded-[6px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.25)] transition-transform duration-200">
          <Image src="/assets/svg/shield.svg" alt="Shield" width={12} height={12} />
        </span>
      </button>
    </div>
  )

  // Fully disconnected: one compact pill, same height as the rest of the nav
  // row (no stacking yet — nothing to stack). Once the first chain connects,
  // swap to the two-pill stack below so each chain gets its own connect
  // state + dropdown without ever showing two oversized "Connect" pills at
  // once (that was overflowing the nav — see PR feedback).
  const walletCluster = !isWaapConnected && !isAztecConnected ? (
    <ConnectWalletPill onClick={handleConnectWallet} connecting={isL1Connecting} isDark={isDark} />
  ) : (
    // Merged wallet cluster — a single FLAT segment, not a pill. It holds the
    // ETH row and the Aztec row flush against each other, split by one hairline
    // divider (below). Deliberately NOT a glass pill: a raised pill here read as
    // a second pill sitting ON TOP of the nav's own pill ("pill on pill"), so it
    // carries no fill/shadow/blur and is instead segmented off with a single
    // vertical hairline on its left edge. Each row renders `flat` (plain
    // rectangular rows, no rounded/border/shadow of their own) so the two
    // addresses read as one clean flush segment.
    <div
      className={`flex flex-col w-[150px] sm:w-[252px] flex-shrink-0 pl-2 sm:pl-3 border-l ${
        isDark ? 'border-white/[0.14]' : 'border-black/[0.10]'
      }`}
    >
      {isWaapConnected ? (
        <WalletDisplay
          address={waapAddress || undefined}
          isConnected={isWaapConnected}
          walletIcon={walletIcon || '/assets/wallets/wally-dark.svg'}
          networkIcon="/assets/svg/network-logo.svg"
          balance={l1NativeBalance}
          onDisconnect={disconnectWaapWallet}
          walletType={WalletType.WAAP}
          loginMethod={loginMethod}
          flat
          isDark={isDark}
          actionsLocked={isTransferInProgress}
        />
      ) : (
        <WalletConnectPill
          icon="/assets/svg/network-logo.svg"
          label={isL1Connecting ? '…' : 'Connect'}
          onClick={handleConnectWallet}
          disabled={isL1Connecting}
          title="Connect Ethereum (L1) wallet"
          flat
          isDark={isDark}
        />
      )}

      {/* Single flush divider (#108/#109). Runs edge-to-edge across the full
          width of the wallet segment — a plain full-bleed hairline separating
          the EVM row from the Aztec row. A subtle dark hairline on the light
          glass / a faint white hairline on the dark privacy surface, so it
          reads as one crisp border in either theme without becoming a bright
          bar. */}
      <div
        className={`h-px w-full flex-shrink-0 ${isDark ? 'bg-white/[0.12]' : 'bg-black/[0.08]'}`}
        aria-hidden="true"
      />

      {isAztecConnected ? (
        <WalletDisplay
          address={aztecAddress || undefined}
          displayName={aztecAlias || undefined}
          isConnected={isAztecConnected}
          walletIcon="/assets/svg/aztec-wallet-logo.svg"
          onDisconnect={disconnectAztecWallet}
          availableAccounts={availableAccounts}
          onSelectAccount={switchAztecAccount}
          linkedAccountAddress={sessionLinkedL2 || undefined}
          linkedEvmAddress={waapAddress || undefined}
          walletType={WalletType.AZTEC}
          flat
          isDark={isDark}
          actionsLocked={isTransferInProgress}
        />
      ) : (
        <WalletConnectPill
          icon="/assets/svg/aztec-wallet-logo.svg"
          label={isL2Connecting ? '…' : 'Connect Aztec Wallet'}
          onClick={isWaapConnected ? handleConnectAztecOnly : handleConnectWallet}
          disabled={isL2Connecting}
          title="Connect Aztec (L2) wallet"
          flat
          isDark={isDark}
        />
      )}
    </div>
  )

  const secondaryNav = (
    <>
      {credentials && (
        <div
          className={`text-sm font-medium cursor-pointer transition-colors duration-200 whitespace-nowrap ${navText(isDark)} ${
            isDark ? 'hover:text-white' : 'hover:text-latest-grey-800'
          }`}
        >
          {credentials}
        </div>
      )}
      <button
        onClick={() => {
          openHowItWorks()
          setMobileMenuOpen(false)
        }}
        className={`flex items-center gap-1.5 px-3 h-9 text-xs font-medium rounded-full ${navText(isDark)} ${hoverTint(isDark)} transition-colors duration-200 whitespace-nowrap`}
      >
        <Icon icon="ph:question" width={16} height={16} className={isDark ? 'text-white/[0.50]' : 'text-[#737373]'} />
        How it works
      </button>
      <Link
        href="/docs"
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-1.5 px-3 h-9 text-xs font-medium rounded-full ${navText(isDark)} ${hoverTint(isDark)} transition-colors duration-200 whitespace-nowrap`}
      >
        <Icon icon="ph:book-open" width={16} height={16} className={isDark ? 'text-white/[0.50]' : 'text-[#737373]'} />
        Docs
      </Link>
      {/* Direct, always-available entry to the Fee Juice screen — previously only
          reachable by failing a claim (#146). Same pattern/tone as the sibling
          links; shared by the desktop nav and the mobile panel so the label stays
          visible in both. whitespace-nowrap keeps it from wrapping the nav row. */}
      <Link
        href="/fee-juice"
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-1.5 px-3 h-9 text-xs font-medium rounded-full ${navText(isDark)} ${hoverTint(isDark)} transition-colors duration-200 whitespace-nowrap`}
      >
        <Icon icon="ph:gas-pump" width={16} height={16} className={isDark ? 'text-white/[0.50]' : 'text-[#737373]'} />
        Fee Juice
      </Link>
    </>
  )

  return (
    <header className="w-full px-3 sm:px-4 pt-3 flex items-stretch gap-2 sm:gap-3 relative" style={{ containerType: 'inline-size' }}>
      {/* Brand pill — Shield lockup (ported from the SiteTopBar brand-pill slot)
          with the version + network selector stacked directly UNDER it (#113).
          One glass pill holds a column: the home-link logo on top, the
          DeploymentSelector beneath. The logo image keeps its exact 100×27
          dimensions so the brand mark's size/proportions are unchanged — the
          pill just gains a thin second line. The selector is a bare control
          here (no pill material of its own) so it reads as part of the brand
          pill, not a second stacked pill. No fixed height: `items-stretch` on
          the header row matches this column to the main pill's content-driven
          height. */}
      <div
        className={`relative z-40 flex-shrink-0 flex flex-col items-center justify-center gap-1.5 min-h-11 sm:min-h-12 px-3 sm:px-5 py-2 rounded-[26px] ${glassPill(isDark)}`}
      >
        <Link
          href="/"
          onClick={(e) => {
            // Preserve the state-loss guard: while a transfer is in progress,
            // returning to the splash tears down the live /progress view, so
            // confirm first and bail if the user cancels.
            if (isTransferInProgress && !window.confirm(TRANSFER_LEAVE_CONFIRM)) {
              e.preventDefault()
              return
            }
            // Not just route home — re-show the onboarding splash (#103).
            requestShowSplash()
          }}
          className="flex items-center justify-center hover:opacity-80 transition-opacity duration-200"
        >
          <Image src="/assets/svg/shield-lockup-maroon.svg" alt="Shield" width={100} height={27} />
        </Link>
        <DeploymentSelector />
      </div>

      {/* Main pill — secondary nav (left) + always-on cluster (right), ported
          from the SiteTopBar main-pill / bar-right structure. Height is
          content-driven (min-height floor + vertical padding, not a fixed
          height) so the stacked wallet pills can grow it instead of
          overflowing it — a fixed height here was clipping/spilling the
          2-pill stack outside the rounded pill shape. */}
      <div
        className={`flex-1 min-w-0 flex items-center justify-between gap-2 min-h-11 sm:min-h-12 py-1 sm:py-1.5 px-2 sm:px-3 rounded-full ${glassPill(isDark)}`}
      >
        {/* Left: Privacy Mode pinned to the far left of the middle section (#159).
            Flat segment now (#185). A flush hairline on its right edge divides it
            from the centered nav links at lg+ (where those links are present),
            mirroring the wallet cluster's border-l hairline instead of stacking a
            pill. Below lg the border collapses to 0 width so no hairline floats in
            the empty gap. */}
        <div
          className={`flex items-center flex-shrink-0 lg:border-r lg:pr-3 ${
            isDark ? 'border-white/[0.14]' : 'border-black/[0.10]'
          }`}
        >
          {privacyToggle}
        </div>

        {/* Center: the remaining nav links, centered in the bar (#159). flex-1
            fills the gap between the Privacy toggle and the right cluster while
            justify-center pins the links to the middle. Hidden below lg, where
            they move into the mobile panel. */}
        <nav className="hidden lg:flex items-center justify-center gap-1 flex-1 min-w-0" aria-label="Secondary">
          {secondaryNav}
        </nav>

        {/* Right: humanity/points chip, then the wallet cluster and mobile
            toggle (chip sits flush beside the wallet/account stack, #111). The
            chip collapses first on narrow widths; the wallet cluster never
            collapses. */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 min-w-0">
          <div className="hidden sm:block flex-shrink-0">
            <HumanityPointsChip
              method={humanitySource.method}
              passportScore={humanitySource.passportScore}
              passportThreshold={humanitySource.passportThreshold}
              isFetching={humanitySource.isFetching}
              points={points}
              isDark={isDark}
              unverifiedHint={unverifiedHint}
            />
          </div>

          {/* Wallet cluster + an actionable binding notice anchored beneath it.
              A server conflict (or the device-local pre-warn) is surfaced here
              inline — naming the exact counterpart account — instead of being
              buried in the tutorial (issue #98). */}
          <div className="relative flex-shrink-0">
            {walletCluster}
            {walletNotice && (
              <div
                role="alert"
                className={`absolute right-0 top-full mt-2 z-50 w-[240px] rounded-2xl ${panelSurface(isDark)} shadow-lg p-3 flex items-start gap-2 border-l-2 ${
                  conflict ? 'border-l-[#E3357E]' : 'border-l-[#FA8FC4]'
                }`}
              >
                <Icon
                  icon="ph:warning-circle"
                  width={16}
                  height={16}
                  className={`mt-[1px] flex-shrink-0 ${accentPink(isDark)}`}
                />
                <p className={`text-[11px] leading-snug ${navText(isDark)}`}>{walletNotice}</p>
              </div>
            )}
          </div>

          {/* Secondary-nav toggle — only needed below lg, where "How it
              works" / version selector move out of the main row. Privacy
              Mode and the wallet pills above stay in the main row at every
              width, so they never end up hidden behind this button. */}
          <button
            onClick={toggleMobileMenu}
            className={`lg:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${hoverTint(isDark)} transition-colors duration-200`}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <Icon icon={mobileMenuOpen ? 'ph:x' : 'ph:list'} width={20} height={20} className={navText(isDark)} />
          </button>
        </div>
      </div>

      {/* Secondary-nav panel (credentials / How it works / Docs) — the version
          + network selector lives under the Shield brand pill now (#113), not here. */}
      {mobileMenuOpen && (
        <div ref={mobileMenuRef} className={`lg:hidden absolute top-full left-3 right-3 sm:left-4 sm:right-4 mt-2 z-50 ${panelSurface(isDark)} rounded-2xl shadow-lg py-3 px-3 flex flex-col items-start gap-2`}>
          {secondaryNav}
        </div>
      )}

      <ReactTooltip
        id="privacy-mode-tooltip"
        place="bottom"
        className="z-[100]"
        style={{
          fontSize: '12px',
          padding: '4px 8px',
        }}
      />
    </header>
  )
}

export default Header
