/**
 * Tests for server/core/kernel.mjs
 * Mocks all heavy sub-modules to avoid actual I/O.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all sub-module imports used by kernel
vi.mock('../../core/asar.mjs', () => ({ default: { unload: vi.fn() } }))
vi.mock('../../core/collaboration.mjs', () => ({ default: { init: vi.fn() } }))
vi.mock('../../core/db.mjs', () => ({ default: { init: vi.fn() } }))
vi.mock('../../core/extensions.mjs', () => ({ default: { init: vi.fn() } }))
vi.mock('../../core/scheduler.mjs', () => ({ default: { init: vi.fn(), start: vi.fn(), stop: vi.fn() } }))
vi.mock('../../core/servers.mjs', () => ({ default: { stopServers: vi.fn() } }))
vi.mock('../../core/metrics.mjs', () => ({ default: { init: vi.fn() } }))

const { default: kernel } = await import('../../core/kernel.mjs')

describe('kernel banner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    WIKI.version = '3.0.0'
  })

  it('logs "CloudWiki" in the banner on init', async () => {
    // Stub db.init to prevent actual DB connection and halt init early
    const db = (await import('../../core/db.mjs')).default
    db.init.mockRejectedValue(new Error('no db in tests'))

    // init calls process.exit(1) on db error — stub it
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })

    try {
      await kernel.init()
    } catch {
      // expected: process.exit throws in test
    }

    exitSpy.mockRestore()

    // Verify the banner logged "CloudWiki"
    const allInfoCalls = WIKI.logger.info.mock.calls.flat()
    const bannerLine = allInfoCalls.find(line => typeof line === 'string' && line.includes('CloudWiki'))
    expect(bannerLine).toBeDefined()
    expect(bannerLine).toContain('CloudWiki')
  })

  it('logs the current version in the banner', async () => {
    WIKI.version = '9.9.9'
    const db = (await import('../../core/db.mjs')).default
    db.init.mockRejectedValue(new Error('no db'))

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })

    try {
      await kernel.init()
    } catch {
      // expected
    }

    exitSpy.mockRestore()

    const allInfoCalls = WIKI.logger.info.mock.calls.flat()
    const versionLine = allInfoCalls.find(line => typeof line === 'string' && line.includes('9.9.9'))
    expect(versionLine).toBeDefined()
  })

  it('logs "Initializing..." during init', async () => {
    const db = (await import('../../core/db.mjs')).default
    db.init.mockRejectedValue(new Error('no db'))

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })

    try {
      await kernel.init()
    } catch {
      // expected
    }

    exitSpy.mockRestore()

    const allInfoCalls = WIKI.logger.info.mock.calls.flat()
    expect(allInfoCalls.some(l => typeof l === 'string' && l.includes('Initializing'))).toBe(true)
  })
})

describe('kernel.shutdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset isShuttingDown by re-importing is not possible for module-level var,
    // but we can test behavior with the current state
  })

  it('is a function', () => {
    expect(typeof kernel.shutdown).toBe('function')
  })

  it('does not throw in devMode when called with mocked WIKI state', async () => {
    WIKI.servers = { stopServers: vi.fn().mockResolvedValue() }
    WIKI.scheduler = { stop: vi.fn().mockResolvedValue() }
    WIKI.models = undefined
    WIKI.asar = undefined

    // shutdown will not call process.exit in devMode=true
    await expect(kernel.shutdown(true)).resolves.not.toThrow()
  })
})

describe('kernel structure', () => {
  it('exports init function', () => {
    expect(typeof kernel.init).toBe('function')
  })

  it('exports preBootWeb function', () => {
    expect(typeof kernel.preBootWeb).toBe('function')
  })

  it('exports bootWeb function', () => {
    expect(typeof kernel.bootWeb).toBe('function')
  })

  it('exports postBootWeb function', () => {
    expect(typeof kernel.postBootWeb).toBe('function')
  })

  it('exports shutdown function', () => {
    expect(typeof kernel.shutdown).toBe('function')
  })
})
