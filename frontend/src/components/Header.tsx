'use client'

import { Icon, loadIcons } from '@iconify/react'
import { useToast } from '@/hooks/useToast'
import { useWalletStore } from '@/stores/walletStore'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useL1TokenBalances } from '@/hooks/useL1Operations'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { L1_CHAIN_ID, POCH_MINT_URL } from '@/config'
import { useAttestationCheck } from '@/hooks/useAttestationCheck'
import AccountChip from '@/components/AccountChip'
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
    'ph:identification-card',
    'ph:plus-circle',
    'ph:gauge',
    'ph:seal-check-fill',
    'ph:link',
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

/**
 * One shared fixed height for every chip in the top nav row — the Shield brand
 * chip, the center pill (Privacy Mode + nav links), the humanity/points chip,
 * and the account chip. Keeping it a single token is what makes the row read as
 * a clean line of uniform chips: inner contents scale to fit this height rather
 * than each chip's content dictating its own height. The version chip lives
 * BELOW the Shield chip (its own left-column chip), outside this row, so it is
 * deliberately NOT bound to this height. The skinny account chip owns this same
 * height itself (h-14) as a single collapsed row, so it lines up with the rest
 * of the row without Header having to wrap it in a height container.
 */
const CHIP_H = 'h-14'

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
/** Progress-track background under a limit fill bar (Limits & usage section). */
function trackBg(isDark: boolean): string {
  return isDark ? 'bg-white/[0.12]' : 'bg-black/[0.06]'
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
  /** EVM wallet connected — gates the "Get verified" CTA vs the connect prompt. */
  isConnected?: boolean
  /**
   * Copy shown in the expanded panel when the EVM wallet is NOT connected —
   * a prompt to connect it. Once connected, the tooltip surfaces a Get-verified
   * CTA instead (no raw eligibility reason / "0/1 required" framing, per #272).
   */
  unverifiedHint?: string
}

/**
 * Compact Humanity Score + Points indicator (#227). The chip itself shows the
 * live values (score stacked above points), right-justified so they sit flush
 * against the wallet-cluster divider. The breakdown (score bar, "what is this?"
 * explanation, Proof of Clean Hands detail, and the HUMN Points readout) is an
 * info readout, so it lives in a HOVER tooltip (react-tooltip, same pattern as
 * the network + humanity-info tooltips) rather than a click-to-open panel. No
 * caret. The tooltip is `clickable`, so tap-to-open also works on touch.
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
  isConnected = false,
  unverifiedHint = 'Connect your Ethereum wallet to verify personhood.',
}) => {
  // A ZERO passport score counts as "no score yet" — the chip never renders a
  // bare 0 (#272). It shows a neutral "—" on the face and a Get-verified CTA in
  // the tooltip instead.
  const hasScore = method === 'passport' && typeof passportScore === 'number' && passportScore > 0
  const isPoch = method === 'poch'
  const isVerified = hasScore || isPoch
  const scoreLabel = hasScore ? String(passportScore) : isPoch ? 'Verified' : '—'
  const scorePct = hasScore
    ? Math.min(100, Math.max(0, (passportScore! / (passportThreshold || passportScore!)) * 100))
    : isPoch
      ? 100
      : 0

  return (
    <div className="relative">
      {/* Standalone chip (#111/#227), now HORIZONTAL and slim: humanity score
          and HUMN Points sit side by side on one row (score · points) at the
          shared top-row height, instead of the old fat two-line vertical stack.
          Its own glass pill (it was a flat readout when nested in the center
          pill; standalone it carries pill material). No caret — this is an info
          readout, so the breakdown lives in the hover tooltip below (anchored
          via data-tooltip-id). */}
      <button
        type="button"
        data-tooltip-id="humanity-points-tooltip"
        aria-label="Humanity score and HUMN Points. Hover for details"
        className={`${CHIP_H} flex items-center gap-2 px-3 sm:px-4 rounded-[20px] ${glassPill(isDark)} cursor-pointer`}
      >
        {/* Humanity. The green pulsing glow (ported DS chip--glow) is a halo
            around the badge — applied ONLY in the verified/green state,
            mirroring the DS which only glows the green verified chip. */}
        <span className="flex items-center gap-1.5">
          <span className={`inline-flex items-center justify-center rounded-full ${isVerified ? 'humanity-glow' : ''}`}>
            <VerifiedIcon className={`w-4 h-4 ${isVerified ? accentPink(isDark) : isDark ? 'text-white/[0.25]' : 'text-gray-300'}`} />
          </span>
          <span className={`text-sm font-semibold leading-none ${isVerified ? accentPink(isDark) : mutedIconText(isDark)}`}>{scoreLabel}</span>
        </span>
        {/* Slim middot divider between the two readouts. */}
        <span className={`text-sm leading-none ${isDark ? 'text-white/[0.35]' : 'text-black/[0.25]'}`} aria-hidden="true">
          &middot;
        </span>
        {/* HUMN Points — glyph with slow continuous rotation (ported DS chip--spin-icon). */}
        <span className="flex items-center gap-1.5">
          <HumanPointsIcon className={`w-4 h-4 ${navText(isDark)} humn-points-spin`} />
          <span className={`text-sm font-semibold leading-none ${navText(isDark)}`}>{points.toLocaleString()}</span>
        </span>
      </button>

      {/* Hover tooltip carrying the full breakdown (#227). Same react-tooltip
          used for the network + humanity-info tooltips. `clickable` keeps the
          links reachable and doubles as tap-to-open on touch. The interior is a
          dark bubble (react-tooltip's default surface), so its text is styled
          light in both themes rather than via the page's theme helpers. */}
      <ReactTooltip
        id="humanity-points-tooltip"
        place="bottom"
        clickable
        className="z-[100] max-w-[248px]"
        style={{ padding: '12px', borderRadius: '16px' }}
        render={() => (
          <div className="flex flex-col gap-3 text-left">
            <div>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-xs font-medium text-white/[0.70]">Humanity</span>
                {/* JUST a number (#272) — never a fraction or "out of X". A zero
                    or missing score surfaces a Get-verified CTA, not a bare 0. */}
                {isFetching ? (
                  <span className="text-sm font-semibold text-white/[0.60]">Checking…</span>
                ) : hasScore ? (
                  <span className="text-sm font-semibold text-[#FA8FC4]">{passportScore}</span>
                ) : isPoch ? (
                  <span className="text-sm font-semibold text-[#FA8FC4]">Verified</span>
                ) : isConnected ? (
                  <a
                    href="https://app.passport.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-[#FA8FC4] underline"
                  >
                    Get verified
                  </a>
                ) : null}
              </div>
              {(hasScore || isPoch) && (
                <div className="w-full h-1.5 rounded-full bg-white/[0.15] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FA8FC4] transition-[width] duration-300"
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
              )}
              <p className="text-[11px] leading-snug text-white/[0.75] mt-2">
                Your Proof of Personhood Score. Higher means stronger proof you&apos;re a real, unique human.
              </p>
              {/* Sources — the two proofs the score is built from. Brand marks
                  (public/assets/svg) are painted via CSS mask so they inherit the
                  pink accent that reads on the dark tooltip in both themes. */}
              <p className="text-[11px] leading-snug text-white/[0.75] mt-1.5">
                Sources:{' '}
                <a
                  href="https://app.passport.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 align-middle underline font-medium"
                >
                  <span
                    aria-hidden
                    className="inline-block w-[13px] h-[13px] align-middle bg-[#FA8FC4] [mask:url(/assets/svg/passport.svg)_center/contain_no-repeat] [-webkit-mask:url(/assets/svg/passport.svg)_center/contain_no-repeat]"
                  />
                  Human Passport
                </a>{' '}
                and{' '}
                <a
                  href={POCH_MINT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 align-middle underline font-medium"
                >
                  <span
                    aria-hidden
                    className="inline-block w-[13px] h-[13px] align-middle bg-[#FA8FC4] [mask:url(/assets/svg/clean-hands.svg)_center/contain_no-repeat] [-webkit-mask:url(/assets/svg/clean-hands.svg)_center/contain_no-repeat]"
                  />
                  Proof of Clean Hands
                </a>
                .
              </p>
              {/* Clean Hands: held / not-held, with a CTA when not held (#272). */}
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block w-[15px] h-[15px] bg-[#FA8FC4] [mask:url(/assets/svg/clean-hands.svg)_center/contain_no-repeat] [-webkit-mask:url(/assets/svg/clean-hands.svg)_center/contain_no-repeat]"
                  />
                  <span className="text-[11px] font-medium text-[#FA8FC4]">Proof of Clean Hands</span>
                </span>
                {isPoch ? (
                  <a
                    href={POCH_MINT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FA8FC4] underline"
                  >
                    <Icon icon="ph:seal-check-fill" width={13} height={13} />
                    Held
                  </a>
                ) : (
                  <a
                    href={POCH_MINT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-[#FA8FC4] underline"
                  >
                    Get Clean Hands
                  </a>
                )}
              </div>
              {isPoch && (
                // POCH is a boolean proof: the L1 result carries no mint date or
                // expiry, so never fabricate them here.
                <p className="text-[11px] leading-snug text-white/[0.75] mt-1.5">
                  A privacy-preserving proof you&apos;re a real, sanctions-screened human. No numeric score needed. Mint date and expiry aren&apos;t available in this view yet.
                </p>
              )}
              {!isVerified && !isConnected && (
                <p className="text-[11px] leading-snug text-white/[0.70] mt-1.5">{unverifiedHint}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.15]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-white/[0.70]">
                  <HumanPointsIcon className="w-3.5 h-3.5" />
                  HUMN Points
                </span>
                <span className="text-sm font-semibold text-white/[0.90]">{points.toLocaleString()}</span>
              </div>
              {/* TODO: `points` is still the PLACEHOLDER_POINTS stub. Shield has no
                  per-user points source yet. The real value must be fetched from the
                  points backend (the passport/Covenant HUMN Points service) and
                  threaded through the `points` prop. Do NOT fabricate a per-action
                  breakdown here, show only the real single balance once it's wired. */}
              <p className="text-[11px] leading-snug text-white/[0.75]">
                HUMN Points reward real, verified humans, not bots, across human.tech.
              </p>
            </div>
          </div>
        )}
      />
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
        className={`flex w-[36px] h-[22px] sm:w-[40px] sm:h-[24px] py-[3px] px-1 items-center rounded-full transition-all duration-200 border-0 focus:outline-none relative z-10 flex-shrink-0 ${
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
        <span className="flex w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] p-[1px] justify-center items-center flex-shrink-0 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.25)] transition-transform duration-200">
          <Image src="/assets/svg/shield.svg" alt="Shield" width={12} height={12} />
        </span>
      </button>
    </div>
  )

  // Skinny variant-A account chip — a single uniform-height nav chip standing at
  // the right end of the nav (like the Shield brand chip). It encapsulates the
  // connect / connected states and the Wallets · Identity & proofs · Limits &
  // usage · Disconnect dropdown, reading wallet-store state itself. Header only
  // threads the props it can't self-source: the connect actions, the derived
  // connecting/lock/balance flags, and the authoritative binding data (conflict
  // notice + server-disclosed linked L2 account).
  const accountChip = (
    <AccountChip
      isDark={isDark}
      onConnectWallet={handleConnectWallet}
      onConnectAztec={handleConnectAztecOnly}
      isL1Connecting={isL1Connecting}
      isL2Connecting={isL2Connecting}
      l1NativeBalance={l1NativeBalance}
      actionsLocked={isTransferInProgress}
      loginMethod={loginMethod}
      conflictNotice={walletNotice || undefined}
      conflictSevere={!!conflict}
      linkedAccountAddress={sessionLinkedL2 || undefined}
    />
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
    <header className="w-full px-3 sm:px-4 pt-3 flex items-start gap-2 sm:gap-3 relative" style={{ containerType: 'inline-size' }}>
      {/* Left column — the Shield BRAND chip on top (brand only), and the
          version/network selector as its OWN separate chip directly beneath it
          (#113). No chip-in-chip: the version dropdown is no longer stacked
          inside the brand pill. The brand chip shares the uniform top-row height
          (CHIP_H); the version chip hangs below it, OUTSIDE that row — so the
          header uses items-start, letting this column be taller than the row
          without stretching the other chips. */}
      <div className="flex flex-col items-stretch gap-2 flex-shrink-0 relative z-40">
        {/* Shield brand chip — logo + wordmark only. */}
        <div className={`${CHIP_H} flex items-center justify-center px-3 sm:px-5 rounded-[26px] ${glassPill(isDark)}`}>
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
            <Image src={isDark ? '/assets/svg/shield-lockup-white.svg' : '/assets/svg/shield-lockup-maroon.svg'} alt="Shield" width={100} height={27} />
          </Link>
        </div>
        {/* Version chip — its own rounded, visually distinct chip. The
            DeploymentSelector supplies its own tinted pill material, caret, and
            expandable network/version dropdown; here it simply sits centered
            directly under the brand chip. */}
        <div className="flex justify-center">
          <DeploymentSelector />
        </div>
      </div>

      {/* Center pill — Privacy Mode pinned left, secondary nav links centered
          (lg+), and the mobile-nav hamburger at the right (below lg). Uniform
          top-row height. No nested chips: the humanity/points readout and the
          account chip have moved OUT into their own standalone chips to the
          right of this pill. */}
      <div className={`${CHIP_H} flex-1 min-w-0 flex items-center justify-between gap-2 pl-4 pr-2 sm:pl-5 sm:pr-3 rounded-full ${glassPill(isDark)}`}>
        {/* Privacy Mode — pinned far left (#159), a flat segment (#185) with a
            flush hairline on its right edge dividing it from the centered nav
            links at lg+. Below lg the border collapses so no hairline floats. */}
        <div
          className={`flex items-center flex-shrink-0 lg:border-r lg:pr-3 ${
            isDark ? 'border-white/[0.14]' : 'border-black/[0.10]'
          }`}
        >
          {privacyToggle}
        </div>

        {/* Centered nav links (#159). flex-1 + justify-center pins them to the
            middle. Hidden below lg, where they move into the mobile panel. */}
        <nav className="hidden lg:flex items-center justify-center gap-1 flex-1 min-w-0" aria-label="Secondary">
          {secondaryNav}
        </nav>

        {/* Mobile-nav toggle — only below lg, where the nav links collapse into
            the panel. */}
        <button
          onClick={toggleMobileMenu}
          className={`lg:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${hoverTint(isDark)} transition-colors duration-200`}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <Icon icon={mobileMenuOpen ? 'ph:x' : 'ph:list'} width={20} height={20} className={navText(isDark)} />
        </button>
      </div>

      {/* Humanity/points chip — its own standalone chip at the uniform top-row
          height, slim and horizontal (score · points). Hidden below sm, where
          the row gets tight. */}
      <div className="hidden sm:block flex-shrink-0">
        <HumanityPointsChip
          method={humanitySource.method}
          passportScore={humanitySource.passportScore}
          passportThreshold={humanitySource.passportThreshold}
          isFetching={humanitySource.isFetching}
          points={points}
          isDark={isDark}
          isConnected={isWaapConnected}
          unverifiedHint={unverifiedHint}
        />
      </div>

      {/* Account chip — the skinny variant-A chip, its own standalone glass pill
          at the uniform top-row height (CHIP_H / h-14 supplied by AccountChip
          itself), pulled OUT of the center pill so it sits on its own at the
          right end. A single collapsed row (avatars + Account + verified + caret)
          that opens the account dropdown. The binding-conflict notice renders as
          a static banner inside that dropdown (#282), not a floating overlay. */}
      <div className="relative z-40 flex-shrink-0">
        {accountChip}
      </div>

      {/* Mobile secondary-nav panel (credentials / How it works / Docs / Fee
          Juice) — the version chip lives under the Shield brand chip now (#113),
          not here. */}
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
