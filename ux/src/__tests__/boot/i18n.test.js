import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// vi.mock is hoisted — cannot reference variables declared after it.
// Use vi.hoisted() to create mocks that are safe to reference in factory.
const { createI18nMock, mockI18nInstance } = vi.hoisted(() => {
  const mockI18nInstance = {
    install: vi.fn(),
    _options: null
  }
  const createI18nMock = vi.fn((options) => {
    mockI18nInstance._options = options
    return mockI18nInstance
  })
  return { createI18nMock, mockI18nInstance }
})

vi.mock('vue-i18n', () => ({
  createI18n: createI18nMock
}))

vi.mock('@/stores/common', () => ({
  useCommonStore: vi.fn(() => ({
    locale: 'en'
  }))
}))

globalThis.APOLLO_CLIENT = { query: vi.fn(), mutate: vi.fn() }
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import { initializeI18n } from '@/boot/i18n'

describe('i18n boot', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    createI18nMock.mockImplementation((options) => {
      mockI18nInstance._options = options
      return mockI18nInstance
    })
  })

  it('initializeI18n creates i18n instance', () => {
    const mockApp = { use: vi.fn() }
    initializeI18n(mockApp, createPinia())
    expect(createI18nMock).toHaveBeenCalledOnce()
    expect(mockApp.use).toHaveBeenCalledWith(mockI18nInstance)
  })

  it('EN locale is bundled (not empty messages)', () => {
    const mockApp = { use: vi.fn() }
    initializeI18n(mockApp, createPinia())
    const options = createI18nMock.mock.calls[0][0]
    expect(options.messages).toBeDefined()
    expect(options.messages.en).toBeDefined()
    expect(Object.keys(options.messages.en).length).toBeGreaterThan(0)
  })

  it('fallback locale is "en"', () => {
    const mockApp = { use: vi.fn() }
    initializeI18n(mockApp, createPinia())
    const options = createI18nMock.mock.calls[0][0]
    expect(options.fallbackLocale).toBe('en')
  })
})
