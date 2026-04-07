import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

globalThis.APOLLO_CLIENT = { query: vi.fn(), mutate: vi.fn() }

import { useCommonStore } from '@/stores/common'

describe('common store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('defaults locale to "en" when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      expect(store.locale).toBe('en')
    })

    it('uses locale from localStorage when set', () => {
      localStorageMock.getItem.mockReturnValue('pt')
      const store = useCommonStore()
      expect(store.locale).toBe('pt')
    })

    it('sets desiredLocale from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('fr')
      const store = useCommonStore()
      expect(store.desiredLocale).toBe('fr')
    })

    it('has desiredLocale as null when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      expect(store.desiredLocale).toBeNull()
    })

    it('initializes routerLoading as false', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      expect(store.routerLoading).toBe(false)
    })

    it('initializes blocksLoaded as empty array', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      expect(store.blocksLoaded).toEqual([])
    })
  })

  describe('setLocale action', () => {
    it('updates locale', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      store.setLocale('es')
      expect(store.locale).toBe('es')
    })

    it('updates desiredLocale', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      store.setLocale('de')
      expect(store.desiredLocale).toBe('de')
    })

    it('persists locale to localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      store.setLocale('ja')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('locale', 'ja')
    })
  })

  describe('fetchLocaleStrings action', () => {
    it('queries apollo client with the given locale', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      APOLLO_CLIENT.query.mockResolvedValue({ data: { localeStrings: { hello: 'Hello' } } })
      const result = await store.fetchLocaleStrings('en')
      expect(APOLLO_CLIENT.query).toHaveBeenCalled()
      expect(result).toEqual({ hello: 'Hello' })
    })

    it('throws when apollo query fails', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      const store = useCommonStore()
      APOLLO_CLIENT.query.mockRejectedValue(new Error('Network error'))
      await expect(store.fetchLocaleStrings('en')).rejects.toThrow('Network error')
    })
  })
})
