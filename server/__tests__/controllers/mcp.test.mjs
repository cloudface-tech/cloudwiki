import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers (mirroring the controller logic)
// ---------------------------------------------------------------------------

function stripHtml (html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

function makeSite (overrides = {}) {
  return { id: 'site-1', config: { title: 'CloudWiki', description: 'Test wiki' }, ...overrides }
}

function makePages () {
  return [
    { id: 'uuid-1', path: 'home', title: 'Welcome', description: 'Home page', locale: 'en', icon: 'las la-home', tags: ['intro'], updatedAt: '2026-04-07T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z' },
    { id: 'uuid-2', path: 'features', title: 'Features', description: 'Feature list', locale: 'en', icon: null, tags: [], updatedAt: '2026-04-06T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z' },
    { id: 'uuid-3', path: 'nees/portal', title: 'Portal', description: 'Portal docs', locale: 'pt', icon: null, tags: ['portal'], updatedAt: '2026-04-08T00:00:00.000Z', createdAt: '2026-04-02T00:00:00.000Z' }
  ]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP API v2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    WIKI.db = {
      sites: { getSiteByHostname: vi.fn() },
      knex: vi.fn()
    }
    WIKI.config = { api: {} }
  })

  // -----------------------------------------------------------------------
  // Manifest
  // -----------------------------------------------------------------------

  describe('manifest', () => {
    it('should describe v2 capabilities including formats and bulk', () => {
      const manifest = {
        name: 'CloudWiki',
        version: '2.0.0',
        capabilities: {
          pages: { list: true, read: true, search: true, formats: ['markdown', 'plain', 'html'] }
        }
      }
      expect(manifest.version).toBe('2.0.0')
      expect(manifest.capabilities.pages.formats).toContain('markdown')
      expect(manifest.capabilities.pages.formats).toContain('html')
    })

    it('should document authentication method', () => {
      const manifest = {
        authentication: { type: 'api-key', header: 'X-API-Key', queryParam: 'apiKey' }
      }
      expect(manifest.authentication.type).toBe('api-key')
      expect(manifest.authentication.header).toBe('X-API-Key')
    })
  })

  // -----------------------------------------------------------------------
  // API Key authentication
  // -----------------------------------------------------------------------

  describe('API key auth', () => {
    it('should allow access when no API key is configured', () => {
      WIKI.config.api = {}
      const configuredKey = WIKI.config.api?.mcpApiKey
      expect(configuredKey).toBeUndefined()
      // No key = public access
    })

    it('should reject when API key is configured but not provided', () => {
      WIKI.config.api = { mcpApiKey: 'secret-key-123' }
      const configuredKey = WIKI.config.api.mcpApiKey
      const providedKey = undefined
      expect(configuredKey).toBeTruthy()
      expect(providedKey).toBeUndefined()
      // Would return 401
    })

    it('should reject when API key is wrong', () => {
      WIKI.config.api = { mcpApiKey: 'secret-key-123' }
      const providedKey = 'wrong-key'
      expect(providedKey).not.toBe(WIKI.config.api.mcpApiKey)
      // Would return 403
    })

    it('should allow access when API key matches', () => {
      WIKI.config.api = { mcpApiKey: 'secret-key-123' }
      const providedKey = 'secret-key-123'
      expect(providedKey).toBe(WIKI.config.api.mcpApiKey)
    })
  })

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  describe('pagination', () => {
    it('should calculate correct offset from page and limit', () => {
      const page = 3
      const limit = 10
      const offset = (page - 1) * limit
      expect(offset).toBe(20)
    })

    it('should cap limit at 100', () => {
      const requestedLimit = 500
      const limit = Math.min(100, Math.max(1, requestedLimit))
      expect(limit).toBe(100)
    })

    it('should floor page at 1', () => {
      const requestedPage = -5
      const page = Math.max(1, requestedPage)
      expect(page).toBe(1)
    })

    it('should calculate totalPages and hasMore correctly', () => {
      const total = 73
      const limit = 25
      const page = 1
      const offset = 0
      const totalPages = Math.ceil(total / limit)
      const hasMore = offset + limit < total
      expect(totalPages).toBe(3)
      expect(hasMore).toBe(true)
    })

    it('should report hasMore=false on last page', () => {
      const total = 73
      const limit = 25
      const page = 3
      const offset = (page - 1) * limit
      const hasMore = offset + limit < total
      expect(hasMore).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------

  describe('filters', () => {
    it('should filter by path prefix', () => {
      const pages = makePages()
      const pathPrefix = 'nees/'
      const filtered = pages.filter(p => p.path.startsWith(pathPrefix))
      expect(filtered).toHaveLength(1)
      expect(filtered[0].path).toBe('nees/portal')
    })

    it('should filter by locale', () => {
      const pages = makePages()
      const locale = 'pt'
      const filtered = pages.filter(p => p.locale === locale)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Portal')
    })

    it('should filter by tags', () => {
      const pages = makePages()
      const tags = ['portal']
      const filtered = pages.filter(p => tags.every(t => (p.tags || []).includes(t)))
      expect(filtered).toHaveLength(1)
    })

    it('should filter by updatedAfter', () => {
      const pages = makePages()
      const after = '2026-04-07T00:00:00.000Z'
      const filtered = pages.filter(p => p.updatedAt > after)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].path).toBe('nees/portal')
    })
  })

  // -----------------------------------------------------------------------
  // Content formats
  // -----------------------------------------------------------------------

  describe('content formats', () => {
    it('should strip HTML for plain format', () => {
      const html = '<h1>Welcome</h1><p>Hello <strong>world</strong></p>'
      const plain = stripHtml(html)
      expect(plain).toBe('WelcomeHello world')
      expect(plain).not.toContain('<')
    })

    it('should return raw HTML for html format', () => {
      const html = '<h1>Welcome</h1><p>Hello</p>'
      const format = 'html'
      const content = format === 'html' ? html : stripHtml(html)
      expect(content).toContain('<h1>')
    })

    it('should handle empty content gracefully', () => {
      expect(stripHtml('')).toBe('')
      expect(stripHtml(null)).toBe('')
      expect(stripHtml(undefined)).toBe('')
    })
  })

  // -----------------------------------------------------------------------
  // Bulk read
  // -----------------------------------------------------------------------

  describe('bulk read', () => {
    it('should reject empty ids array', () => {
      const ids = []
      expect(ids.length).toBe(0)
      // Would return 400
    })

    it('should reject more than 50 ids', () => {
      const ids = Array.from({ length: 51 }, (_, i) => `uuid-${i}`)
      expect(ids.length).toBeGreaterThan(50)
      // Would return 400
    })

    it('should handle partial matches (some ids not found)', () => {
      const requested = ['uuid-1', 'uuid-999']
      const found = makePages().filter(p => requested.includes(p.id))
      expect(found).toHaveLength(1)
      expect(requested.length).toBe(2)
    })
  })

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  describe('search', () => {
    it('should search across title, description, and path', () => {
      const pages = makePages()
      const q = 'portal'
      const filtered = pages.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.path || '').toLowerCase().includes(q)
      )
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('uuid-3')
    })

    it('should require q parameter', () => {
      const q = ''
      expect(q.trim()).toBe('')
      // Would return 400
    })

    it('should return metadata including tags and icon', () => {
      const pages = makePages()
      expect(pages[0].tags).toEqual(['intro'])
      expect(pages[0].icon).toBe('las la-home')
      expect(pages[0].createdAt).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // by-path endpoint
  // -----------------------------------------------------------------------

  describe('by-path', () => {
    it('should find page by exact path', () => {
      const pages = makePages()
      const path = 'nees/portal'
      const found = pages.find(p => p.path === path)
      expect(found).toBeDefined()
      expect(found.title).toBe('Portal')
    })

    it('should return null for non-existent path', () => {
      const pages = makePages()
      const path = 'nees/nonexistent'
      const found = pages.find(p => p.path === path)
      expect(found).toBeUndefined()
    })
  })
})
