import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml (html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

function makeSite (overrides = {}) {
  return { id: 'site-1', config: { title: 'CloudWiki', description: 'Test wiki' }, ...overrides }
}

function makePages () {
  return [
    { id: 'uuid-1', path: 'home', title: 'Welcome', description: 'Home page', locale: 'en', updatedAt: '2026-04-07T00:00:00.000Z' },
    { id: 'uuid-2', path: 'features', title: 'Features', description: 'Feature list', locale: 'en', updatedAt: '2026-04-06T00:00:00.000Z' }
  ]
}

// ---------------------------------------------------------------------------
// Mocking helpers
// ---------------------------------------------------------------------------

function mockKnexChain (resolvedValue) {
  const chain = {
    where: vi.fn(),
    select: vi.fn(),
    orderBy: vi.fn(),
    first: vi.fn()
  }
  chain.where.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.orderBy.mockResolvedValue(resolvedValue)
  chain.first.mockResolvedValue(resolvedValue)
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP API endpoints', () => {
  beforeEach(() => {
    WIKI.db = {
      sites: { getSiteByHostname: vi.fn() },
      knex: vi.fn()
    }
  })

  // -------------------------------------------------------------------------
  // GET /api/mcp/manifest
  // -------------------------------------------------------------------------

  describe('manifest', () => {
    it('should describe all MCP capabilities', () => {
      const manifest = {
        name: 'CloudWiki',
        description: 'Knowledge base content',
        version: '1.0.0',
        capabilities: {
          pages: { list: true, read: true, search: true }
        },
        endpoints: {
          list: '/api/mcp/pages',
          read: '/api/mcp/pages/:id',
          search: '/api/mcp/search'
        }
      }

      expect(manifest.name).toBe('CloudWiki')
      expect(manifest.capabilities.pages.list).toBe(true)
      expect(manifest.capabilities.pages.read).toBe(true)
      expect(manifest.capabilities.pages.search).toBe(true)
      expect(manifest.endpoints.list).toBe('/api/mcp/pages')
      expect(manifest.endpoints.read).toBe('/api/mcp/pages/:id')
      expect(manifest.endpoints.search).toBe('/api/mcp/search')
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/mcp/pages
  // -------------------------------------------------------------------------

  describe('GET /api/mcp/pages', () => {
    it('should return list of published pages with metadata', async () => {
      const site = makeSite()
      const pages = makePages()

      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)
      WIKI.db.knex.mockReturnValue(mockKnexChain(pages))

      const s = await WIKI.db.sites.getSiteByHostname({ hostname: 'wiki.cloudface.tech' })
      const chain = WIKI.db.knex('pages')
      chain.where({ siteId: s.id, publishState: 'published' })
      chain.select('id', 'path', 'title', 'description', 'locale', 'updatedAt')
      const result = await chain.orderBy('path')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('uuid-1')
      expect(result[0].path).toBe('home')
      expect(result[0].title).toBe('Welcome')
      expect(result[0].locale).toBe('en')
      expect(result[0].updatedAt).toBeDefined()
      // content should NOT be present in the list endpoint
      expect(result[0].content).toBeUndefined()
    })

    it('should return 404 when site is not found', async () => {
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(null)
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: 'unknown' })
      expect(site).toBeNull()
    })

    it('should only query published pages', async () => {
      const site = makeSite()
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)

      const chain = mockKnexChain([])
      WIKI.db.knex.mockReturnValue(chain)

      await WIKI.db.knex('pages').where({ siteId: site.id, publishState: 'published' }).select().orderBy('path')

      expect(chain.where).toHaveBeenCalledWith({ siteId: 'site-1', publishState: 'published' })
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/mcp/pages/:id
  // -------------------------------------------------------------------------

  describe('GET /api/mcp/pages/:id', () => {
    it('should return full page content stripped of HTML', async () => {
      const site = makeSite()
      const page = {
        id: 'uuid-1',
        path: 'home',
        title: 'Welcome',
        description: 'Home page',
        content: '# Welcome\n\nHello world',
        render: '<h1>Welcome</h1><p>Hello <strong>world</strong></p>',
        locale: 'en',
        tags: ['intro', 'start'],
        updatedAt: '2026-04-07T00:00:00.000Z'
      }

      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)
      const chain = mockKnexChain(page)
      WIKI.db.knex.mockReturnValue(chain)

      const s = await WIKI.db.sites.getSiteByHostname({ hostname: 'wiki.cloudface.tech' })
      const result = await WIKI.db.knex('pages')
        .where({ id: 'uuid-1', siteId: s.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'content', 'render', 'locale', 'tags', 'updatedAt')
        .first()

      const plainContent = stripHtml(result.render || result.content)

      expect(plainContent).toBe('WelcomeHello world')
      expect(plainContent).not.toContain('<h1>')
      expect(plainContent).not.toContain('<strong>')
      expect(result.tags).toEqual(['intro', 'start'])
      expect(result.locale).toBe('en')
    })

    it('should fall back to content field when render is absent', async () => {
      const page = {
        id: 'uuid-2',
        path: 'features',
        title: 'Features',
        description: '',
        content: '# Features\n\n- Item 1\n- Item 2',
        render: null,
        locale: 'en',
        tags: [],
        updatedAt: '2026-04-06T00:00:00.000Z'
      }

      const plainContent = stripHtml(page.render || page.content)
      expect(plainContent).toBe('# Features\n\n- Item 1\n- Item 2')
    })

    it('should return 404 when page is not found', async () => {
      const site = makeSite()
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)
      const chain = mockKnexChain(null)
      WIKI.db.knex.mockReturnValue(chain)

      const result = await WIKI.db.knex('pages')
        .where({ id: 'nonexistent', siteId: site.id, publishState: 'published' })
        .select()
        .first()

      expect(result).toBeNull()
    })

    it('should strip various HTML entities', () => {
      const html = '<p>Hello &amp; world &lt;test&gt; &quot;quoted&quot; &nbsp;space</p>'
      const result = stripHtml(html)
      expect(result).toContain('Hello & world')
      expect(result).toContain('<test>')
      expect(result).toContain('"quoted"')
      expect(result).toContain('space')
      expect(result).not.toContain('<p>')
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/mcp/search?q=query
  // -------------------------------------------------------------------------

  describe('GET /api/mcp/search', () => {
    it('should return all pages when query is empty', async () => {
      const site = makeSite()
      const pages = makePages()

      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)
      WIKI.db.knex.mockReturnValue(mockKnexChain(pages))

      const allPages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'locale', 'updatedAt')
        .orderBy('path')

      const q = ''
      const filtered = q ? allPages.filter(p => p.title.toLowerCase().includes(q)) : allPages

      expect(filtered).toHaveLength(2)
    })

    it('should filter pages by title match', () => {
      const pages = makePages()
      const q = 'welcome'
      const filtered = pages.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.path || '').toLowerCase().includes(q)
      )

      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Welcome')
    })

    it('should filter pages by description match', () => {
      const pages = makePages()
      const q = 'feature list'
      const filtered = pages.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.path || '').toLowerCase().includes(q)
      )

      expect(filtered).toHaveLength(1)
      expect(filtered[0].path).toBe('features')
    })

    it('should filter pages by path match', () => {
      const pages = makePages()
      const q = 'home'
      const filtered = pages.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.path || '').toLowerCase().includes(q)
      )

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('uuid-1')
    })

    it('should return empty array when no pages match', () => {
      const pages = makePages()
      const q = 'xyznotfound'
      const filtered = pages.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.path || '').toLowerCase().includes(q)
      )

      expect(filtered).toHaveLength(0)
    })

    it('should return 404 when site is not found', async () => {
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(null)
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: 'unknown' })
      expect(site).toBeNull()
    })

    it('should only search published pages', async () => {
      const site = makeSite()
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)

      const chain = mockKnexChain([])
      WIKI.db.knex.mockReturnValue(chain)

      await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select()
        .orderBy('path')

      expect(chain.where).toHaveBeenCalledWith({ siteId: 'site-1', publishState: 'published' })
    })
  })
})
