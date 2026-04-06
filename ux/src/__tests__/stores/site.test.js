import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

globalThis.APOLLO_CLIENT = { query: vi.fn(), mutate: vi.fn() }

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

describe('site store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('default state', () => {
    it('has id as null', () => {
      const store = useSiteStore()
      expect(store.id).toBeNull()
    })

    it('has empty hostname', () => {
      const store = useSiteStore()
      expect(store.hostname).toBe('')
    })

    it('has dark as false', () => {
      const store = useSiteStore()
      expect(store.dark).toBe(false)
    })

    it('has empty title', () => {
      const store = useSiteStore()
      expect(store.title).toBe('')
    })

    it('has logoText as true', () => {
      const store = useSiteStore()
      expect(store.logoText).toBe(true)
    })

    it('has printView as false', () => {
      const store = useSiteStore()
      expect(store.printView).toBe(false)
    })

    it('has showSideNav as true', () => {
      const store = useSiteStore()
      expect(store.showSideNav).toBe(true)
    })

    it('has showSidebar as true', () => {
      const store = useSiteStore()
      expect(store.showSidebar).toBe(true)
    })

    it('has overlay as null', () => {
      const store = useSiteStore()
      expect(store.overlay).toBeNull()
    })

    it('has default features', () => {
      const store = useSiteStore()
      expect(store.features.profile).toBe(false)
      expect(store.features.ratingsMode).toBe('off')
      expect(store.features.reasonForChange).toBe('required')
      expect(store.features.search).toBe(false)
    })

    it('has default editors all false', () => {
      const store = useSiteStore()
      expect(store.editors.asciidoc).toBe(false)
      expect(store.editors.markdown).toBe(false)
      expect(store.editors.wysiwyg).toBe(false)
    })

    it('has primary locale as "en"', () => {
      const store = useSiteStore()
      expect(store.locales.primary).toBe('en')
    })

    it('has English as the default active locale', () => {
      const store = useSiteStore()
      expect(store.locales.active).toHaveLength(1)
      expect(store.locales.active[0].code).toBe('en')
    })

    it('has empty tags array', () => {
      const store = useSiteStore()
      expect(store.tags).toEqual([])
    })

    it('has tagsLoaded as false', () => {
      const store = useSiteStore()
      expect(store.tagsLoaded).toBe(false)
    })

    it('has default theme colors', () => {
      const store = useSiteStore()
      expect(store.theme.colorPrimary).toBe('#1976D2')
      expect(store.theme.colorSecondary).toBe('#02C39A')
      expect(store.theme.colorAccent).toBe('#f03a47')
    })

    it('has default theme sidebar position as "left"', () => {
      const store = useSiteStore()
      expect(store.theme.sidebarPosition).toBe('left')
    })

    it('has default theme toc position as "right"', () => {
      const store = useSiteStore()
      expect(store.theme.tocPosition).toBe('right')
    })

    it('has nav with null currentId and empty items', () => {
      const store = useSiteStore()
      expect(store.nav.currentId).toBeNull()
      expect(store.nav.items).toEqual([])
    })
  })

  describe('getters', () => {
    describe('overlayIsShown', () => {
      it('returns false when overlay is null', () => {
        const store = useSiteStore()
        expect(store.overlayIsShown).toBe(false)
      })

      it('returns true when overlay is set', () => {
        const store = useSiteStore()
        store.$patch({ overlay: 'FileManager' })
        expect(store.overlayIsShown).toBe(true)
      })
    })

    describe('sideNavIsDisabled', () => {
      it('returns false when sidebarPosition is "left"', () => {
        const store = useSiteStore()
        expect(store.sideNavIsDisabled).toBe(false)
      })

      it('returns true when sidebarPosition is "off"', () => {
        const store = useSiteStore()
        store.$patch({ theme: { ...store.theme, sidebarPosition: 'off' } })
        expect(store.sideNavIsDisabled).toBe(true)
      })
    })

    describe('useLocales', () => {
      it('returns false when only one locale is active', () => {
        const store = useSiteStore()
        expect(store.useLocales).toBe(false)
      })

      it('returns true when multiple locales are active', () => {
        const store = useSiteStore()
        store.$patch({
          locales: {
            primary: 'en',
            active: [
              { code: 'en', language: 'en', name: 'English', nativeName: 'English' },
              { code: 'pt', language: 'pt', name: 'Portuguese', nativeName: 'Português' }
            ]
          }
        })
        expect(store.useLocales).toBe(true)
      })
    })

    describe('scrollStyle', () => {
      it('returns light scroll style when user appearance is "site" and theme is not dark', () => {
        const siteStore = useSiteStore()
        const userStore = useUserStore()
        userStore.$patch({ appearance: 'site' })
        siteStore.$patch({ theme: { ...siteStore.theme, dark: false } })
        const style = siteStore.scrollStyle
        expect(style.thumb.backgroundColor).toBe('#000')
        expect(style.bar.backgroundColor).toBe('#FAFAFA')
      })

      it('returns dark scroll style when user appearance is "dark"', () => {
        const siteStore = useSiteStore()
        const userStore = useUserStore()
        userStore.$patch({ appearance: 'dark' })
        const style = siteStore.scrollStyle
        expect(style.thumb.backgroundColor).toBe('#FFF')
        expect(style.bar.backgroundColor).toBe('#000')
      })

      it('returns light scroll style when user appearance is "light"', () => {
        const siteStore = useSiteStore()
        const userStore = useUserStore()
        userStore.$patch({ appearance: 'light' })
        const style = siteStore.scrollStyle
        expect(style.thumb.backgroundColor).toBe('#000')
      })
    })
  })

  describe('openFileManager action', () => {
    it('sets overlay to "FileManager"', () => {
      const store = useSiteStore()
      store.openFileManager()
      expect(store.overlay).toBe('FileManager')
    })

    it('sets insertMode to false by default', () => {
      const store = useSiteStore()
      store.openFileManager()
      expect(store.overlayOpts.insertMode).toBe(false)
    })

    it('sets insertMode to true when passed as option', () => {
      const store = useSiteStore()
      store.openFileManager({ insertMode: true })
      expect(store.overlayOpts.insertMode).toBe(true)
    })
  })
})
