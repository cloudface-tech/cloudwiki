import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

globalThis.APOLLO_CLIENT = { query: vi.fn(), mutate: vi.fn() }
globalThis.EVENT_BUS = { emit: vi.fn() }

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    remove: vi.fn()
  }
}))

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn()
}))

vi.mock('@/helpers/accessibility', () => ({
  getAccessibleColor: vi.fn((base, hexBase, cvd) => hexBase)
}))

import { useUserStore } from '@/stores/user'
import { jwtDecode } from 'jwt-decode'
import Cookies from 'js-cookie'

describe('user store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Cookies.get.mockReturnValue(undefined)
  })

  describe('default state', () => {
    it('has default guest id', () => {
      const store = useUserStore()
      expect(store.id).toBe('10000000-0000-4000-8000-000000000001')
    })

    it('has empty email', () => {
      const store = useUserStore()
      expect(store.email).toBe('')
    })

    it('has empty name', () => {
      const store = useUserStore()
      expect(store.name).toBe('')
    })

    it('has hasAvatar as false', () => {
      const store = useUserStore()
      expect(store.hasAvatar).toBe(false)
    })

    it('has appearance as "site"', () => {
      const store = useUserStore()
      expect(store.appearance).toBe('site')
    })

    it('has cvd as "none"', () => {
      const store = useUserStore()
      expect(store.cvd).toBe('none')
    })

    it('has empty permissions array', () => {
      const store = useUserStore()
      expect(store.permissions).toEqual([])
    })

    it('has empty pagePermissions array', () => {
      const store = useUserStore()
      expect(store.pagePermissions).toEqual([])
    })

    it('has authenticated as false', () => {
      const store = useUserStore()
      expect(store.authenticated).toBe(false)
    })

    it('has profileLoaded as false', () => {
      const store = useUserStore()
      expect(store.profileLoaded).toBe(false)
    })

    it('has dateFormat as "YYYY-MM-DD"', () => {
      const store = useUserStore()
      expect(store.dateFormat).toBe('YYYY-MM-DD')
    })

    it('has timeFormat as "12h"', () => {
      const store = useUserStore()
      expect(store.timeFormat).toBe('12h')
    })
  })

  describe('getters', () => {
    describe('preferredDateFormat', () => {
      it('converts YYYY-MM-DD to yyyy-MM-dd', () => {
        const store = useUserStore()
        expect(store.preferredDateFormat).toBe('yyyy-MM-dd')
      })

      it('returns "D" when dateFormat is empty string', () => {
        const store = useUserStore()
        store.$patch({ dateFormat: '' })
        expect(store.preferredDateFormat).toBe('D')
      })

      it('returns "D" when dateFormat is null', () => {
        const store = useUserStore()
        store.$patch({ dateFormat: null })
        expect(store.preferredDateFormat).toBe('D')
      })
    })

    describe('preferredTimeFormat', () => {
      it('returns "t" for 12h format', () => {
        const store = useUserStore()
        store.$patch({ timeFormat: '12h' })
        expect(store.preferredTimeFormat).toBe('t')
      })

      it('returns "T" for 24h format', () => {
        const store = useUserStore()
        store.$patch({ timeFormat: '24h' })
        expect(store.preferredTimeFormat).toBe('T')
      })
    })
  })

  describe('can() method', () => {
    it('returns false when no permissions', () => {
      const store = useUserStore()
      expect(store.can('read:pages')).toBe(false)
    })

    it('returns true when permission is directly included', () => {
      const store = useUserStore()
      store.$patch({ permissions: ['read:pages', 'write:pages'] })
      expect(store.can('read:pages')).toBe(true)
    })

    it('returns true when user has "manage:system" (superadmin)', () => {
      const store = useUserStore()
      store.$patch({ permissions: ['manage:system'] })
      expect(store.can('read:pages')).toBe(true)
      expect(store.can('write:assets')).toBe(true)
    })

    it('returns true when permission is in pagePermissions', () => {
      const store = useUserStore()
      store.$patch({ pagePermissions: ['read:pages'] })
      expect(store.can('read:pages')).toBe(true)
    })

    it('returns false when permission is not in any list', () => {
      const store = useUserStore()
      store.$patch({ permissions: ['read:pages'], pagePermissions: ['write:comments'] })
      expect(store.can('delete:pages')).toBe(false)
    })
  })

  describe('loadToken action', () => {
    it('does nothing when token is falsy', () => {
      const store = useUserStore()
      store.$patch({ token: null })
      store.loadToken()
      expect(store.authenticated).toBe(false)
    })

    it('sets authenticated to false if token is expired', () => {
      const store = useUserStore()
      const pastExp = Math.floor(Date.now() / 1000) - 3600
      jwtDecode.mockReturnValue({ id: 'abc', email: 'test@test.com', iat: 0, exp: pastExp })
      store.$patch({ token: 'fake.jwt.token' })
      store.loadToken()
      expect(store.authenticated).toBe(false)
    })

    it('sets authenticated to true if token is valid', () => {
      const store = useUserStore()
      const futureExp = Math.floor(Date.now() / 1000) + 3600
      jwtDecode.mockReturnValue({ id: 'user-id', email: 'user@test.com', iat: 0, exp: futureExp })
      store.$patch({ token: 'fake.jwt.token' })
      store.loadToken()
      expect(store.authenticated).toBe(true)
      expect(store.id).toBe('user-id')
      expect(store.email).toBe('user@test.com')
    })

    it('handles malformed JWT gracefully', () => {
      const store = useUserStore()
      jwtDecode.mockImplementation(() => { throw new Error('Invalid token') })
      store.$patch({ token: 'bad.token' })
      store.loadToken()
      expect(store.authenticated).toBe(false)
    })
  })

  describe('logout action', () => {
    it('resets state to defaults', () => {
      const store = useUserStore()
      store.$patch({
        name: 'John Doe',
        email: 'john@test.com',
        authenticated: true,
        permissions: ['read:pages']
      })
      store.logout()
      expect(store.name).toBe('')
      expect(store.email).toBe('')
      expect(store.authenticated).toBe(false)
      expect(store.permissions).toEqual([])
    })

    it('removes JWT cookie', () => {
      const store = useUserStore()
      store.logout()
      expect(Cookies.remove).toHaveBeenCalledWith('jwt', { path: '/' })
    })

    it('emits logout event', () => {
      const store = useUserStore()
      store.logout()
      expect(EVENT_BUS.emit).toHaveBeenCalledWith('logout')
    })
  })

  describe('appearance settings', () => {
    it('defaults appearance to "site"', () => {
      const store = useUserStore()
      expect(store.appearance).toBe('site')
    })

    it('can be patched to "dark"', () => {
      const store = useUserStore()
      store.$patch({ appearance: 'dark' })
      expect(store.appearance).toBe('dark')
    })

    it('can be patched to "light"', () => {
      const store = useUserStore()
      store.$patch({ appearance: 'light' })
      expect(store.appearance).toBe('light')
    })
  })
})
