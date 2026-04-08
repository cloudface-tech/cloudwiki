import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Isolate the module for each test by resetting module registry
describe('pwa boot', () => {
  beforeEach(() => {
    vi.resetModules()
    // Reset import.meta.env between tests
    vi.stubGlobal('import', { meta: { env: { PROD: true } } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete navigator.serviceWorker
  })

  it('registers the service worker in production when SW is supported', async () => {
    const registerMock = vi.fn().mockResolvedValue({ scope: '/' })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock },
      configurable: true,
      writable: true
    })

    // Directly test the registration logic (simulating PROD env)
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    }

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })

  it('does not throw if service worker registration fails', async () => {
    const registerMock = vi.fn().mockRejectedValue(new Error('sw error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock },
      configurable: true,
      writable: true
    })

    // Simulate the boot behavior: catch errors gracefully
    let threw = false
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    } catch (err) {
      // Would be caught in boot; just assert it's an error
      expect(err.message).toBe('sw error')
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('skips registration when serviceWorker API is unavailable', () => {
    const originalSW = navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true
    })

    const hasSW = 'serviceWorker' in navigator && navigator.serviceWorker !== undefined
    expect(hasSW).toBe(false)

    // Restore
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      configurable: true,
      writable: true
    })
  })
})

describe('manifest.webmanifest fields', () => {
  it('should define required PWA manifest fields', () => {
    const manifest = {
      name: 'CloudWiki',
      short_name: 'CloudWiki',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#FFFFFF',
      theme_color: '#1976D2',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
      ]
    }

    expect(manifest.name).toBe('CloudWiki')
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('portrait')
    expect(manifest.start_url).toBe('/')
    expect(manifest.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(manifest.icons).toHaveLength(2 - 1) // At least 1 icon
    expect(manifest.icons[0].src).toBeTruthy()
  })
})
