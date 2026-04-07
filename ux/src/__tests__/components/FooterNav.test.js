import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('quasar', () => ({
  useQuasar: () => ({ dark: { isActive: false }, notify: vi.fn() }),
  useMeta: vi.fn(),
  setCssVar: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key) => key, locale: { value: 'en' } }),
  createI18n: vi.fn(() => ({ install: vi.fn() }))
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} })
}))

vi.mock('@/stores/site', () => ({
  useSiteStore: () => ({
    company: 'TestCo',
    contentLicense: 'cc',
    footerExtra: '',
    id: 'test-site-id'
  })
}))

import FooterNav from '@/components/FooterNav.vue'

describe('FooterNav', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders without errors', () => {
    const wrapper = shallowMount(FooterNav, {
      global: {
        stubs: {
          'q-footer': { template: '<footer><slot /></footer>' },
          'i18n-t': { template: '<span><slot name="link" /></span>' }
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows "CloudWiki" branding text (not "Wiki.js")', () => {
    const wrapper = shallowMount(FooterNav, {
      global: {
        stubs: {
          'q-footer': { template: '<footer><slot /></footer>' },
          'i18n-t': { template: '<span><slot name="link" /></span>' }
        }
      }
    })
    const html = wrapper.html()
    expect(html).toContain('CloudWiki')
    expect(html).not.toContain('Wiki.js')
  })

  it('contains link to wiki.cloudface.tech', () => {
    const wrapper = shallowMount(FooterNav, {
      global: {
        stubs: {
          'q-footer': { template: '<footer><slot /></footer>' },
          'i18n-t': { template: '<span><slot name="link" /></span>' }
        }
      }
    })
    const html = wrapper.html()
    expect(html).toContain('wiki.cloudface.tech')
  })
})
