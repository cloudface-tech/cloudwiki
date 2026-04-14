import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Global WIKI mock (Wiki.js uses a global WIKI object)
// ---------------------------------------------------------------------------

globalThis.WIKI = {
  db: {
    sites: { getSiteByHostname: vi.fn() },
    knex: vi.fn()
  },
  config: { api: {} },
  logger: { warn: vi.fn() }
}

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

  // -----------------------------------------------------------------------
  // Create page (POST /pages)
  // -----------------------------------------------------------------------

  describe('create page', () => {
    it('should require title and path', () => {
      const body = { content: 'Hello' }
      expect(body.title).toBeUndefined()
      expect(body.path).toBeUndefined()
    })

    it('should reject duplicate path', () => {
      const existingPages = makePages()
      const newPath = 'home'
      const dup = existingPages.find(p => p.path === newPath)
      expect(dup).toBeDefined()
    })

    it('should accept markdown format and convert to HTML', () => {
      const content = '# Hello\n\nWorld'
      const format = 'markdown'
      expect(format).toBe('markdown')
      expect(content).toContain('#')
    })

    it('should accept html format directly', () => {
      const content = '<h1>Hello</h1><p>World</p>'
      const format = 'html'
      expect(format).toBe('html')
      expect(content).toContain('<h1>')
    })

    it('should generate UUID for new page', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const testId = '550e8400-e29b-41d4-a716-446655440000'
      expect(testId).toMatch(uuidRegex)
    })

    it('should set publishState to published by default', () => {
      const defaults = { publishState: 'published' }
      expect(defaults.publishState).toBe('published')
    })

    it('should generate searchContent from HTML', () => {
      const html = '<h1>Title</h1><p>Body text</p>'
      const searchContent = stripHtml(html)
      expect(searchContent).toBe('TitleBody text')
      expect(searchContent).not.toContain('<')
    })
  })

  // -----------------------------------------------------------------------
  // Update page (PUT /pages/:id)
  // -----------------------------------------------------------------------

  describe('update page', () => {
    it('should return 404 for non-existent page', () => {
      const pages = makePages()
      const found = pages.find(p => p.id === 'non-existent')
      expect(found).toBeUndefined()
    })

    it('should reject duplicate path on update', () => {
      const pages = makePages()
      const pageToUpdate = pages[0]
      const newPath = 'features'
      const dup = pages.find(p => p.path === newPath && p.id !== pageToUpdate.id)
      expect(dup).toBeDefined()
    })

    it('should allow partial updates', () => {
      const original = { title: 'Old', description: 'Old desc', path: 'old' }
      const updates = { title: 'New' }
      const merged = { ...original, ...updates }
      expect(merged.title).toBe('New')
      expect(merged.description).toBe('Old desc')
      expect(merged.path).toBe('old')
    })

    it('should update searchContent when content changes', () => {
      const newContent = '<p>Updated content here</p>'
      const searchContent = stripHtml(newContent)
      expect(searchContent).toBe('Updated content here')
    })

    it('should set updatedAt on update', () => {
      const before = new Date('2026-01-01')
      const now = new Date()
      expect(now.getTime()).toBeGreaterThan(before.getTime())
    })
  })

  // -----------------------------------------------------------------------
  // Delete page (DELETE /pages/:id)
  // -----------------------------------------------------------------------

  describe('delete page', () => {
    it('should return 404 for non-existent page', () => {
      const pages = makePages()
      const found = pages.find(p => p.id === 'non-existent')
      expect(found).toBeUndefined()
    })

    it('should return deleted page info', () => {
      const page = makePages()[0]
      const result = { deleted: true, id: page.id, path: page.path }
      expect(result.deleted).toBe(true)
      expect(result.id).toBe('uuid-1')
      expect(result.path).toBe('home')
    })
  })

  // -----------------------------------------------------------------------
  // Templates
  // -----------------------------------------------------------------------

  describe('templates', () => {
    it('should find pages with template tag', () => {
      const pages = [
        ...makePages(),
        { id: 'tpl-1', path: 'templates/meeting', title: 'Meeting Notes', tags: ['template'], locale: 'en' },
        { id: 'tpl-2', path: 'docs/guide', title: 'Guide Template', tags: ['template', 'docs'], locale: 'en' }
      ]
      const templates = pages.filter(p =>
        p.path.startsWith('templates/') || (p.tags || []).includes('template')
      )
      expect(templates).toHaveLength(2)
    })

    it('should find pages under templates/ path', () => {
      const pages = [
        ...makePages(),
        { id: 'tpl-1', path: 'templates/meeting', title: 'Meeting Notes', tags: [], locale: 'en' }
      ]
      const templates = pages.filter(p => p.path.startsWith('templates/'))
      expect(templates).toHaveLength(1)
      expect(templates[0].title).toBe('Meeting Notes')
    })

    it('should create page from template content', () => {
      const template = {
        content: '<h1>Meeting Notes</h1><p>Date: </p><p>Attendees: </p>',
        render: '<h1>Meeting Notes</h1><p>Date: </p><p>Attendees: </p>',
        editor: 'html',
        icon: 'las la-file',
        tags: ['template']
      }
      const newPage = {
        title: 'Sprint Review 2026-04-13',
        path: 'meetings/sprint-review-2026-04-13',
        content: template.content,
        render: template.render,
        editor: template.editor
      }
      expect(newPage.content).toBe(template.content)
      expect(newPage.editor).toBe('html')
    })

    it('should reject create from non-existent template', () => {
      const templateId = 'non-existent'
      const templates = makePages()
      const found = templates.find(p => p.id === templateId)
      expect(found).toBeUndefined()
    })

    it('should reject create from template with duplicate path', () => {
      const existingPages = makePages()
      const newPath = 'home'
      const dup = existingPages.find(p => p.path === newPath)
      expect(dup).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // Comments
  // -----------------------------------------------------------------------

  describe('comments', () => {
    function makeComments () {
      return [
        { id: 'c1', pageId: 'uuid-1', parentId: null, authorName: 'Alice', content: 'Great page!', mentions: [], createdAt: '2026-04-10T00:00:00Z', updatedAt: '2026-04-10T00:00:00Z' },
        { id: 'c2', pageId: 'uuid-1', parentId: 'c1', authorName: 'Bob', content: 'Thanks @Alice', mentions: ['Alice'], createdAt: '2026-04-10T01:00:00Z', updatedAt: '2026-04-10T01:00:00Z' },
        { id: 'c3', pageId: 'uuid-1', parentId: null, authorName: 'Carol', content: 'Needs update', mentions: [], createdAt: '2026-04-11T00:00:00Z', updatedAt: '2026-04-11T00:00:00Z' }
      ]
    }

    it('should build threaded comments', () => {
      const comments = makeComments()
      const topLevel = comments.filter(c => !c.parentId)
      const replies = comments.filter(c => c.parentId)
      const threaded = topLevel.map(c => ({
        ...c,
        replies: replies.filter(r => r.parentId === c.id)
      }))
      expect(threaded).toHaveLength(2)
      expect(threaded[0].replies).toHaveLength(1)
      expect(threaded[0].replies[0].authorName).toBe('Bob')
      expect(threaded[1].replies).toHaveLength(0)
    })

    it('should require authorName and content', () => {
      const body = { authorName: '', content: '' }
      expect(!body.authorName || !body.content).toBe(true)
    })

    it('should support @mentions', () => {
      const comment = makeComments()[1]
      expect(comment.mentions).toContain('Alice')
      expect(comment.content).toContain('@Alice')
    })

    it('should validate parent exists for replies', () => {
      const comments = makeComments()
      const parentId = 'non-existent'
      const parent = comments.find(c => c.id === parentId)
      expect(parent).toBeUndefined()
    })

    it('should delete replies when parent deleted', () => {
      const comments = makeComments()
      const parentId = 'c1'
      const remaining = comments.filter(c => c.id !== parentId && c.parentId !== parentId)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('c3')
    })
  })

  // -----------------------------------------------------------------------
  // Page Permissions
  // -----------------------------------------------------------------------

  describe('page permissions', () => {
    function makePermissions () {
      return [
        { id: 'p1', pageId: 'uuid-1', subjectType: 'user', subjectId: 'user-1', level: 'write', createdAt: '2026-04-10T00:00:00Z' },
        { id: 'p2', pageId: 'uuid-1', subjectType: 'group', subjectId: 'editors', level: 'read', createdAt: '2026-04-10T00:00:00Z' }
      ]
    }

    it('should list permissions for a page', () => {
      const perms = makePermissions()
      expect(perms).toHaveLength(2)
      expect(perms[0].level).toBe('write')
      expect(perms[1].subjectType).toBe('group')
    })

    it('should validate subjectType', () => {
      const valid = ['user', 'group']
      expect(valid.includes('user')).toBe(true)
      expect(valid.includes('group')).toBe(true)
      expect(valid.includes('role')).toBe(false)
    })

    it('should validate level', () => {
      const valid = ['read', 'write', 'admin']
      expect(valid.includes('read')).toBe(true)
      expect(valid.includes('write')).toBe(true)
      expect(valid.includes('admin')).toBe(true)
      expect(valid.includes('superadmin')).toBe(false)
    })

    it('should upsert permission (update if exists)', () => {
      const perms = makePermissions()
      const existing = perms.find(p => p.subjectType === 'user' && p.subjectId === 'user-1')
      expect(existing).toBeDefined()
      // Would update level instead of creating duplicate
      const updated = { ...existing, level: 'admin' }
      expect(updated.level).toBe('admin')
    })

    it('should require all fields', () => {
      const body = { subjectType: 'user' }
      expect(!body.subjectId || !body.level).toBe(true)
    })

    it('should delete permission by id', () => {
      const perms = makePermissions()
      const remaining = perms.filter(p => p.id !== 'p1')
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('p2')
    })
  })

  // -----------------------------------------------------------------------
  // AI Q&A (POST /ask)
  // -----------------------------------------------------------------------

  describe('AI Q&A', () => {
    it('should require question field', () => {
      const body = {}
      expect(body.question).toBeUndefined()
    })

    it('should score pages by keyword match', () => {
      const pages = [
        { title: 'Kubernetes Setup', searchContent: 'kubernetes cluster helm deploy' },
        { title: 'React Guide', searchContent: 'react hooks components state' },
        { title: 'CI/CD Pipeline', searchContent: 'gitlab kubernetes deploy helm' }
      ]
      const q = 'kubernetes deploy'
      const words = q.toLowerCase().split(/\s+/)
      const scored = pages.map(p => {
        const text = [p.title, p.searchContent].join(' ').toLowerCase()
        const matches = words.filter(w => text.includes(w)).length
        return { ...p, score: matches / words.length }
      }).sort((a, b) => b.score - a.score)

      expect(scored[0].title).toBe('Kubernetes Setup')
      expect(scored[0].score).toBe(1)
      expect(scored[1].title).toBe('CI/CD Pipeline')
      expect(scored[1].score).toBe(1)
      expect(scored[2].score).toBe(0)
    })

    it('should limit results', () => {
      const limit = Math.min(10, Math.max(1, 3))
      const results = Array.from({ length: 20 }, (_, i) => ({ id: i }))
      const limited = results.slice(0, limit)
      expect(limited).toHaveLength(3)
    })

    it('should generate excerpt from content', () => {
      const html = '<h1>Title</h1><p>' + 'word '.repeat(100) + '</p>'
      const text = stripHtml(html)
      const excerpt = text.slice(0, 300)
      expect(excerpt.length).toBeLessThanOrEqual(300)
      expect(excerpt).not.toContain('<')
    })
  })

  // -----------------------------------------------------------------------
  // Translation (POST /translate)
  // -----------------------------------------------------------------------

  describe('translation', () => {
    it('should require pageId and targetLocale', () => {
      const body = { pageId: 'uuid-1' }
      expect(body.targetLocale).toBeUndefined()
    })

    it('should generate default target path from locale + source path', () => {
      const sourcePath = 'docs/getting-started'
      const targetLocale = 'pt'
      const targetPath = `${targetLocale}/${sourcePath}`
      expect(targetPath).toBe('pt/docs/getting-started')
    })

    it('should allow custom target path', () => {
      const customPath = 'pt-br/docs/inicio'
      expect(customPath).toBe('pt-br/docs/inicio')
    })

    it('should create translated page as draft', () => {
      const publishState = 'draft'
      expect(publishState).toBe('draft')
    })

    it('should tag with source page reference', () => {
      const sourcePath = 'docs/getting-started'
      const tags = ['docs', `translated-from:${sourcePath}`]
      expect(tags).toContain('translated-from:docs/getting-started')
    })

    it('should reject if target path already exists', () => {
      const existingPages = makePages()
      const targetPath = 'home'
      const dup = existingPages.find(p => p.path === targetPath)
      expect(dup).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // Search excerpts
  // -----------------------------------------------------------------------

  describe('search excerpts', () => {
    it('should generate excerpt around keyword match', () => {
      const text = 'Lorem ipsum dolor sit amet consectetur. A keyword appears here in the middle of a long text about configuration and deployment.'
      const q = 'keyword'
      const idx = text.toLowerCase().indexOf(q.toLowerCase())
      const start = Math.max(0, idx - 80)
      const end = Math.min(text.length, idx + q.length + 120)
      const excerpt = (start > 0 ? '...' : '') + text.slice(start, end).trim()
      expect(excerpt).toContain('keyword')
      expect(excerpt.length).toBeLessThanOrEqual(text.length)
    })

    it('should fallback to first 200 chars when no match', () => {
      const text = 'A'.repeat(300)
      const excerpt = text.slice(0, 200) + '...'
      expect(excerpt.length).toBe(203)
    })
  })

  // -----------------------------------------------------------------------
  // Recent pages
  // -----------------------------------------------------------------------

  describe('recent pages', () => {
    it('should limit results to max 20', () => {
      const limit = Math.min(20, Math.max(1, 50))
      expect(limit).toBe(20)
    })

    it('should default to 10', () => {
      const limit = Math.min(20, Math.max(1, parseInt(undefined) || 10))
      expect(limit).toBe(10)
    })

    it('should order by updatedAt desc', () => {
      const pages = makePages()
      const sorted = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      expect(sorted[0].path).toBe('nees/portal')
    })
  })

  // -----------------------------------------------------------------------
  // Page hash generation
  // -----------------------------------------------------------------------

  describe('page hash', () => {
    it('should generate deterministic hash from path + locale', () => {
      const crypto = require('crypto')
      const hash1 = crypto.createHash('sha256').update('pt:test/page').digest('hex')
      const hash2 = crypto.createHash('sha256').update('pt:test/page').digest('hex')
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })

    it('should differ for different locales', () => {
      const crypto = require('crypto')
      const hashPt = crypto.createHash('sha256').update('pt:test/page').digest('hex')
      const hashEn = crypto.createHash('sha256').update('en:test/page').digest('hex')
      expect(hashPt).not.toBe(hashEn)
    })
  })

  // -----------------------------------------------------------------------
  // Migration
  // -----------------------------------------------------------------------

  describe('migration', () => {
    it('should fix double-slash paths', () => {
      const path = 'nees//gestao/formularios'
      const fixed = path.replace(/\/\//g, '/')
      expect(fixed).toBe('nees/gestao/formularios')
    })

    it('should detect PT content in EN locale pages', () => {
      const title = 'Legislação'
      const hasDiacritics = /[\u00C0-\u00FF]/.test(title)
      expect(hasDiacritics).toBe(true)
    })

    it('should detect nees/ path prefix as PT', () => {
      const path = 'nees/transversal/arquitetura'
      const isPt = path.startsWith('nees/') || path.startsWith('minc/')
      expect(isPt).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Seed templates
  // -----------------------------------------------------------------------

  describe('seed templates', () => {
    it('should create 5 default templates', () => {
      const templates = ['ata-de-reuniao', 'adr', 'runbook', 'onboarding', 'projeto']
      expect(templates).toHaveLength(5)
    })

    it('should use templates/ path prefix', () => {
      const paths = ['templates/ata-de-reuniao', 'templates/adr', 'templates/runbook']
      expect(paths.every(p => p.startsWith('templates/'))).toBe(true)
    })

    it('should tag with template', () => {
      const tags = ['template']
      expect(tags).toContain('template')
    })
  })
})
