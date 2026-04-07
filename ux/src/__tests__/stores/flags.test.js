import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

globalThis.APOLLO_CLIENT = { query: vi.fn(), mutate: vi.fn() }

import { useFlagsStore } from '@/stores/flags'

describe('flags store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('has loaded as false', () => {
      const store = useFlagsStore()
      expect(store.loaded).toBe(false)
    })

    it('has experimental as false', () => {
      const store = useFlagsStore()
      expect(store.experimental).toBe(false)
    })
  })

  describe('load action', () => {
    it('patches state with systemFlags and sets loaded to true', async () => {
      APOLLO_CLIENT.query.mockResolvedValue({
        data: {
          systemFlags: {
            experimental: true
          }
        }
      })
      const store = useFlagsStore()
      await store.load()
      expect(store.loaded).toBe(true)
      expect(store.experimental).toBe(true)
    })

    it('throws when systemFlags is null', async () => {
      APOLLO_CLIENT.query.mockResolvedValue({ data: { systemFlags: null } })
      const store = useFlagsStore()
      await expect(store.load()).rejects.toThrow('Could not fetch system flags.')
    })

    it('throws when apollo query fails', async () => {
      APOLLO_CLIENT.query.mockRejectedValue({ message: 'Network error', networkError: null })
      const store = useFlagsStore()
      await expect(store.load()).rejects.toBeDefined()
    })

    it('does not set loaded when query fails', async () => {
      APOLLO_CLIENT.query.mockRejectedValue({ message: 'Network error', networkError: null })
      const store = useFlagsStore()
      try { await store.load() } catch {}
      expect(store.loaded).toBe(false)
    })
  })
})
