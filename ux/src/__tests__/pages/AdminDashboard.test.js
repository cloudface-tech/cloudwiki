import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('quasar', () => ({
  useQuasar: () => ({ dark: { isActive: false }, notify: vi.fn(), dialog: vi.fn(() => ({ onOk: vi.fn() })) }),
  useMeta: vi.fn(),
  setCssVar: vi.fn(),
  useDialogPluginComponent: Object.assign(
    () => ({
      dialogRef: { value: null },
      onDialogHide: vi.fn(),
      onDialogOK: vi.fn(),
      onDialogCancel: vi.fn()
    }),
    { emits: ['ok', 'hide'] }
  )
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key) => key, locale: { value: 'en' } }),
  createI18n: vi.fn(() => ({ install: vi.fn() }))
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} })
}))

vi.mock('@/stores/flags', () => ({
  useFlagsStore: () => ({ experimental: false })
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ can: () => true })
}))

const mockAdminStore = {
  loading: true,
  sites: [],
  info: {
    groupsTotal: 0,
    usersTotal: 0,
    loginsPastDay: 0,
    currentVersion: 'n/a',
    latestVersion: 'n/a'
  },
  currentSiteId: 'site-1',
  isVersionLatest: false
}

vi.mock('@/stores/admin', () => ({
  useAdminStore: () => mockAdminStore
}))

import AdminDashboard from '@/pages/AdminDashboard.vue'

const stubs = {
  'q-page': { template: '<div><slot /></div>' },
  'q-card': { template: '<div><slot /></div>' },
  'q-card-section': { template: '<div><slot /></div>' },
  'q-card-actions': { template: '<div><slot /></div>' },
  'q-separator': { template: '<hr />' },
  'q-btn': { template: '<button />' },
  'q-banner': { template: '<div><slot /><slot name="action" /></div>' },
  'q-skeleton': { template: '<div class="q-skeleton" />' }
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAdminStore.loading = true
    mockAdminStore.sites = []
    mockAdminStore.info = {
      groupsTotal: 0,
      usersTotal: 0,
      loginsPastDay: 0,
      currentVersion: 'n/a',
      latestVersion: 'n/a'
    }
    mockAdminStore.isVersionLatest = false
  })

  it('renders without errors', () => {
    const wrapper = shallowMount(AdminDashboard, { global: { stubs } })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows skeleton when adminStore.loading is true', () => {
    mockAdminStore.loading = true
    const wrapper = shallowMount(AdminDashboard, { global: { stubs } })
    const html = wrapper.html()
    expect(html).toContain('q-skeleton')
  })

  it('hides skeleton when adminStore.loading is false', () => {
    mockAdminStore.loading = false
    mockAdminStore.sites = [{ id: 'site-1', title: 'Site 1' }]
    const wrapper = shallowMount(AdminDashboard, { global: { stubs } })
    const html = wrapper.html()
    expect(html).not.toContain('q-skeleton')
  })

  it('shows content cards when adminStore.loading is false', () => {
    mockAdminStore.loading = false
    mockAdminStore.sites = [{ id: 'site-1', title: 'Site 1' }]
    mockAdminStore.info.usersTotal = 42
    const wrapper = shallowMount(AdminDashboard, { global: { stubs } })
    const html = wrapper.html()
    expect(html).toContain('admin.sites.title')
    expect(html).toContain('admin.groups.title')
    expect(html).toContain('admin.users.title')
  })

  it('does not show content cards when loading', () => {
    mockAdminStore.loading = true
    const wrapper = shallowMount(AdminDashboard, { global: { stubs } })
    const html = wrapper.html()
    expect(html).not.toContain('admin.sites.title')
  })
})
