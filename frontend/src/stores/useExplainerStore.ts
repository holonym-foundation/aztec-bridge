'use client'

import { create } from 'zustand'

interface ExplainerState {
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void
}

export const useExplainerStore = create<ExplainerState>((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}))
