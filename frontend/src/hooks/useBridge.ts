'use client'

import { createContext, useContext, useMemo } from 'react'
import { HumanTechBridge, type HumanTechBridgeConfig } from '@human.tech/clean.sdk'

export const BridgeContext = createContext<HumanTechBridge | null>(null)

export interface BridgeProviderConfig extends HumanTechBridgeConfig {
  children: React.ReactNode
}

// `enabled` gates instantiation to the client: HumanTechBridge resolves its domain from
// window.location, so constructing it during server render throws. Server render passes a
// null bridge; only client-gated wallet UI ever reads the context (never the SSR'd docs).
export function useBridgeInstance(
  config: HumanTechBridgeConfig,
  enabled = true,
): HumanTechBridge | null {
  return useMemo(
    () => (enabled ? new HumanTechBridge(config) : null),
    [enabled, config.deployment, config.domain, config.apiUrl, config.l1RpcUrl, config.l2NodeUrl],
  )
}

export function useBridge(): HumanTechBridge {
  const bridge = useContext(BridgeContext)
  if (!bridge) {
    throw new Error('useBridge must be used within a BridgeContext.Provider')
  }
  return bridge
}
