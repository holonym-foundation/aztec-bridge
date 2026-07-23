'use client'

import { create } from 'zustand'

interface OnboardingState {
  // True while the onboarding splash is covering the app. For a connected user
  // the real nav is lifted ABOVE the splash overlay (see data-ob-splash in
  // ShieldOnboarding), and the splash's own background is the light paper
  // field — so while it's up the nav must stay in its light styling even when
  // Privacy Mode is on, or it renders white-on-light-pink (issue #94).
  splashActive: boolean
  setSplashActive: (active: boolean) => void
  // Bumped when the user asks to return to the splash by clicking the Shield
  // brand (issue #103). ShieldOnboarding re-shows the splash on each change.
  showSplashNonce: number
  requestShowSplash: () => void
  // Bumped when the splash hands a first-run user over to the app. The splash's
  // last CTA only connects the Ethereum wallet, but the app's first step needs
  // both — so the steps panel, which already names the missing one and carries
  // its connect button, opens itself instead of waiting to be discovered behind
  // its tab.
  showStepsNonce: number
  requestShowSteps: () => void
  // The guided tour that walks a first-run user through the same four steps as
  // the tutorial panel, one bubble per step, anchored to the control each step
  // is about.
  tourOpen: boolean
  startTour: () => void
  endTour: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  splashActive: false,
  setSplashActive: (active) => set({ splashActive: active }),
  showSplashNonce: 0,
  requestShowSplash: () => set((s) => ({ showSplashNonce: s.showSplashNonce + 1 })),
  showStepsNonce: 0,
  requestShowSteps: () => set((s) => ({ showStepsNonce: s.showStepsNonce + 1 })),
  tourOpen: false,
  startTour: () => set({ tourOpen: true }),
  endTour: () => set({ tourOpen: false }),
}))
