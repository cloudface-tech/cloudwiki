import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('quasar', () => ({
  useQuasar: () => ({
    dark: { isActive: false },
    notify: vi.fn(),
    loading: { show: vi.fn(), hide: vi.fn() }
  }),
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
    id: 'test-site-id',
    company: 'TestCo',
    contentLicense: 'cc'
  })
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    id: null,
    name: ''
  })
}))

vi.mock('graphql-tag', () => ({ default: vi.fn((strings) => strings) }))

vi.mock('js-cookie', () => ({
  default: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }
}))

vi.mock('zxcvbn', () => ({ default: vi.fn(() => ({ score: 3 })) }))

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: vi.fn(() => false),
  browserSupportsWebAuthnAutofill: vi.fn(() => Promise.resolve(false)),
  startAuthentication: vi.fn()
}))

vi.mock('vue3-otp-input', () => ({
  default: { template: '<div />' }
}))

globalThis.APOLLO_CLIENT = {
  query: vi.fn().mockResolvedValue({
    data: {
      authSiteStrategies: [
        {
          id: 'strategy-1',
          activeStrategy: {
            id: 'active-1',
            displayName: 'Local',
            strategy: {
              key: 'local',
              color: 'blue',
              icon: '',
              useForm: true,
              usernameType: 'email'
            },
            registration: true
          }
        }
      ]
    }
  }),
  mutate: vi.fn()
}

import AuthLoginPanel from '@/components/AuthLoginPanel.vue'

describe('AuthLoginPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset APOLLO_CLIENT mock for each test
    globalThis.APOLLO_CLIENT.query.mockResolvedValue({
      data: {
        authSiteStrategies: [
          {
            id: 'strategy-1',
            activeStrategy: {
              id: 'active-1',
              displayName: 'Local',
              strategy: {
                key: 'local',
                color: 'blue',
                icon: '',
                useForm: true,
                usernameType: 'email'
              },
              registration: true
            }
          }
        ]
      }
    })
  })

  it('renders login form', () => {
    const wrapper = shallowMount(AuthLoginPanel, {
      global: {
        stubs: {
          'q-form': { template: '<form><slot /></form>' },
          'q-input': { template: '<input />' },
          'q-btn': { template: '<button><slot /></button>' },
          'q-separator': { template: '<hr />' },
          'q-badge': { template: '<span />' },
          'v-otp-input': { template: '<div />' }
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
    // The default screen is 'login', so a form should be present
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('has email and password input fields', () => {
    const wrapper = shallowMount(AuthLoginPanel, {
      global: {
        stubs: {
          'q-form': { template: '<form><slot /></form>' },
          'q-input': { template: '<input />', props: ['modelValue', 'label', 'type'] },
          'q-btn': { template: '<button />' },
          'q-separator': { template: '<hr />' },
          'q-badge': { template: '<span />' },
          'v-otp-input': { template: '<div />' }
        }
      }
    })
    // In the login screen there should be 2 q-input stubs rendered (email + password)
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it('has login button', () => {
    const wrapper = shallowMount(AuthLoginPanel, {
      global: {
        stubs: {
          'q-form': { template: '<form><slot /></form>' },
          'q-input': { template: '<input />' },
          'q-btn': { template: '<button class="q-btn"><slot /></button>' },
          'q-separator': { template: '<hr />' },
          'q-badge': { template: '<span />' },
          'v-otp-input': { template: '<div />' }
        }
      }
    })
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('has no "Wiki.js" text in the component source', async () => {
    // Test the rendered HTML doesn't contain Wiki.js branding
    const wrapper = shallowMount(AuthLoginPanel, {
      global: {
        stubs: {
          'q-form': { template: '<form><slot /></form>' },
          'q-input': { template: '<input />' },
          'q-btn': { template: '<button />' },
          'q-separator': { template: '<hr />' },
          'q-badge': { template: '<span />' },
          'v-otp-input': { template: '<div />' }
        }
      }
    })
    expect(wrapper.html()).not.toContain('Wiki.js')
  })
})
