import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchWebhook } from '../../modules/webhooks/dispatcher.mjs'

// fetch is global in Node 18+; mock it per test
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSettings (endpoints) {
  return { key: 'webhooks', value: { endpoints } }
}

describe('dispatchWebhook', () => {
  it('does nothing when there is no webhooks setting', async () => {
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(null) }) }
    await dispatchWebhook('page:create', { id: 1 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when endpoints array is missing', async () => {
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue({ key: 'webhooks', value: {} }) }) }
    await dispatchWebhook('page:create', { id: 1 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when no endpoint subscribes to the event', async () => {
    const settings = makeSettings([
      { url: 'https://example.com/hook', events: ['page:delete'], active: true }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }
    await dispatchWebhook('page:create', { id: 1 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when endpoint is inactive', async () => {
    const settings = makeSettings([
      { url: 'https://example.com/hook', events: ['page:create'], active: false }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }
    await dispatchWebhook('page:create', { id: 1 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('POSTs to an active endpoint that subscribes to the event', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const settings = makeSettings([
      { url: 'https://example.com/hook', events: ['page:create', 'page:update'], active: true }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }

    await dispatchWebhook('page:create', { id: 42, path: 'home', locale: 'en', title: 'Home' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://example.com/hook')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers['X-CloudWiki-Event']).toBe('page:create')

    const body = JSON.parse(options.body)
    expect(body.event).toBe('page:create')
    expect(body.data).toEqual({ id: 42, path: 'home', locale: 'en', title: 'Home' })
    expect(body.timestamp).toBeDefined()
  })

  it('POSTs to all matching active endpoints', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const settings = makeSettings([
      { url: 'https://a.example.com/hook', events: ['page:update'], active: true },
      { url: 'https://b.example.com/hook', events: ['page:update'], active: true }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }

    await dispatchWebhook('page:update', { id: 7 })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const urls = mockFetch.mock.calls.map(c => c[0])
    expect(urls).toContain('https://a.example.com/hook')
    expect(urls).toContain('https://b.example.com/hook')
  })

  it('skips an inactive endpoint and still calls active ones', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const settings = makeSettings([
      { url: 'https://inactive.example.com/hook', events: ['page:delete'], active: false },
      { url: 'https://active.example.com/hook', events: ['page:delete'], active: true }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }

    await dispatchWebhook('page:delete', { id: 3 })

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0][0]).toBe('https://active.example.com/hook')
  })

  it('logs a warning and continues when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const settings = makeSettings([
      { url: 'https://bad.example.com/hook', events: ['page:create'], active: true },
      { url: 'https://good.example.com/hook', events: ['page:create'], active: true }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }
    // second call succeeds
    mockFetch.mockResolvedValueOnce(new Error('network error')).mockResolvedValueOnce({ ok: true })

    await expect(dispatchWebhook('page:create', { id: 1 })).resolves.toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('logs a warning when delivery fails', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'))
    const settings = makeSettings([
      { url: 'https://flaky.example.com/hook', events: ['page:create'], active: true }
    ])
    WIKI.db.settings = { query: () => ({ findOne: vi.fn().mockResolvedValue(settings) }) }

    await dispatchWebhook('page:create', { id: 5 })

    expect(WIKI.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Webhooks] Failed to deliver page:create to https://flaky.example.com/hook')
    )
  })
})
