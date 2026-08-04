import { describe, expect, it } from 'vitest'

import {
  buildSwapCandidates,
  computePortalFee,
  formatFjAmount,
  getFeeJuicePriceUsd,
  getTokenPriceUsd,
  usdToTokenAmount,
} from './fuelPricing'

describe('getTokenPriceUsd', () => {
  it('prefers a live feed over the testnet fallback', () => {
    expect(getTokenPriceUsd('WETH', { WETH: 3000 })).toBe(3000)
    expect(getTokenPriceUsd('WETH')).toBe(2100)
  })

  it('matches the feed regardless of symbol casing', () => {
    expect(getTokenPriceUsd('weth', { WETH: 3000 })).toBe(3000)
    expect(getTokenPriceUsd('usdc')).toBe(1)
  })

  it('falls through to the fallback when the feed omits the token', () => {
    expect(getTokenPriceUsd('USDC', { WETH: 3000 })).toBe(1)
  })

  it('prices an unknown token at $1 rather than zero', () => {
    // A zero price would make every USD conversion collapse to 0 or divide by zero.
    expect(getTokenPriceUsd('NOPE')).toBe(1)
  })

  it('reads FeeJuice off the AZTEC feed', () => {
    expect(getFeeJuicePriceUsd({ AZTEC: 0.05 })).toBe(0.05)
  })
})

describe('computePortalFee', () => {
  it('carves fuel out before the portal takes its cut', () => {
    const result = computePortalFee({
      amount: 1_000_000n,
      fuelAmount: 200_000n,
      fuelEnabled: true,
      feeBps: 100n,
    })

    expect(result).toEqual({ baseRaw: 800_000n, feeRaw: 8_000n, receiveRaw: 792_000n })
  })

  it('ignores the fuel amount when fuel is switched off', () => {
    const result = computePortalFee({
      amount: 1_000_000n,
      fuelAmount: 200_000n,
      fuelEnabled: false,
      feeBps: 100n,
    })

    expect(result.baseRaw).toBe(1_000_000n)
  })

  it('never returns a negative base when fuel exceeds the deposit', () => {
    const result = computePortalFee({
      amount: 100n,
      fuelAmount: 500n,
      fuelEnabled: true,
      feeBps: 100n,
    })

    expect(result).toEqual({ baseRaw: 0n, feeRaw: 0n, receiveRaw: 0n })
  })

  it('truncates the fee like the on-chain integer division, never rounding up', () => {
    // TokenPortal.calculateFee does `base * feeBps / 10000` in Solidity; rounding
    // up here would quote the user less than the contract actually delivers.
    const result = computePortalFee({ amount: 199n, fuelAmount: 0n, fuelEnabled: false, feeBps: 100n })

    expect(result.feeRaw).toBe(1n)
    expect(result.receiveRaw).toBe(198n)
  })

  it('charges nothing at zero bps', () => {
    const result = computePortalFee({ amount: 1_000n, fuelAmount: 0n, fuelEnabled: false, feeBps: 0n })

    expect(result).toEqual({ baseRaw: 1_000n, feeRaw: 0n, receiveRaw: 1_000n })
  })
})

describe('formatFjAmount', () => {
  it('keeps the whole part exact and truncates the fraction', () => {
    expect(formatFjAmount(5n * 10n ** 18n)).toBe('5.00')
    expect(formatFjAmount(1_999_999_999_999_999_999n)).toBe('1.99')
  })

  it('pads a sub-unit amount instead of dropping leading zeros', () => {
    expect(formatFjAmount(10n ** 15n, 4)).toBe('0.0010')
  })
})

describe('usdToTokenAmount', () => {
  it('widens the precision as the token amount shrinks', () => {
    expect(usdToTokenAmount(5, 'USDC')).toBe('5.00')
    expect(usdToTokenAmount(50, 'WETH')).toBe('0.0238')
    expect(usdToTokenAmount(5, 'WETH')).toBe('0.002381')
  })

  it('returns "0" for a non-positive price instead of Infinity', () => {
    expect(usdToTokenAmount(5, 'USDC', { USDC: 0 })).toBe('0')
  })
})

describe('buildSwapCandidates', () => {
  const someToken = '0x1111111111111111111111111111111111111111' as const

  it('sorts every pool key so currency0 < currency1, as Uniswap V4 requires', () => {
    for (const route of buildSwapCandidates(someToken)) {
      for (const key of route.poolKeys) {
        expect(BigInt(key.currency0)).toBeLessThan(BigInt(key.currency1))
      }
    }
  })

  it('flags zeroForOne per hop consistently with that hop pool key', () => {
    for (const route of buildSwapCandidates(someToken)) {
      expect(route.zeroForOnes).toHaveLength(route.poolKeys.length)
    }
  })

  it('offers a direct route plus multi-hop fallbacks for a plain ERC-20', () => {
    const routes = buildSwapCandidates(someToken)

    expect(routes[0].label).toBe('direct')
    expect(routes[0].poolKeys).toHaveLength(1)
    expect(routes.filter((r) => r.poolKeys.length === 2).length).toBeGreaterThan(0)
  })

  it('quotes distinct fee tiers on the intermediate hop', () => {
    const labels = buildSwapCandidates(someToken).map((r) => r.label)

    expect(new Set(labels).size).toBe(labels.length)
  })
})
