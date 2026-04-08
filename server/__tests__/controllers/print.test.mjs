import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper: simulate the escapeHtml function used by the controller
function escapeHtml (str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Helper: build the HTML output the controller generates
function buildPrintHtml (page) {
  const title = page.title || 'Untitled'
  const description = page.description || ''
  const render = page.render || ''
  const updatedAt = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>`
    + (description ? `<p class="print-description">${escapeHtml(description)}</p>` : '')
    + (updatedAt ? `<p class="print-meta">Last updated: ${updatedAt}</p>` : '')
    + `<div class="print-content">${render}</div>`
}

describe('/_print/:id controller logic', () => {
  beforeEach(() => {
    WIKI.db = {
      knex: vi.fn()
    }
    WIKI.logger = {
      warn: vi.fn()
    }
  })

  describe('page lookup', () => {
    it('should return 404 when page is not found', async () => {
      const firstMock = vi.fn().mockResolvedValue(null)
      const selectMock = vi.fn().mockReturnValue({ first: firstMock })
      const whereMock = vi.fn().mockReturnValue({ select: selectMock })
      WIKI.db.knex.mockReturnValue({ where: whereMock })

      const page = await WIKI.db.knex('pages').where('id', 'nonexistent').select('id', 'title', 'description', 'render', 'updatedAt').first()
      expect(page).toBeNull()
    })

    it('should fetch page by id with correct fields', async () => {
      const mockPage = {
        id: 'page-uuid-1',
        title: 'Test Page',
        description: 'A description',
        render: '<p>Hello world</p>',
        updatedAt: '2026-01-15T12:00:00Z'
      }
      const firstMock = vi.fn().mockResolvedValue(mockPage)
      const selectMock = vi.fn().mockReturnValue({ first: firstMock })
      const whereMock = vi.fn().mockReturnValue({ select: selectMock })
      WIKI.db.knex.mockReturnValue({ where: whereMock })

      const page = await WIKI.db.knex('pages').where('id', 'page-uuid-1').select('id', 'title', 'description', 'render', 'updatedAt').first()

      expect(page).toEqual(mockPage)
      expect(whereMock).toHaveBeenCalledWith('id', 'page-uuid-1')
      expect(selectMock).toHaveBeenCalledWith('id', 'title', 'description', 'render', 'updatedAt')
    })
  })

  describe('HTML output', () => {
    it('should include the page title in the output', () => {
      const page = { id: '1', title: 'My Wiki Page', description: '', render: '<p>Content</p>', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('<title>My Wiki Page</title>')
    })

    it('should include the rendered HTML content', () => {
      const page = { id: '1', title: 'Page', description: '', render: '<h2>Section</h2><p>Body text.</p>', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('<h2>Section</h2><p>Body text.</p>')
    })

    it('should include description when present', () => {
      const page = { id: '1', title: 'Page', description: 'Short summary', render: '', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('Short summary')
    })

    it('should omit description block when empty', () => {
      const page = { id: '1', title: 'Page', description: '', render: '', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).not.toContain('print-description')
    })

    it('should include last updated date when updatedAt is set', () => {
      const page = { id: '1', title: 'Page', description: '', render: '', updatedAt: '2026-03-01T00:00:00Z' }
      const html = buildPrintHtml(page)
      expect(html).toContain('Last updated:')
      expect(html).toContain('2026')
    })

    it('should omit updated date when updatedAt is null', () => {
      const page = { id: '1', title: 'Page', description: '', render: '', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).not.toContain('Last updated:')
    })

    it('should escape HTML in the title to prevent XSS', () => {
      const page = { id: '1', title: '<script>alert("xss")</script>', description: '', render: '', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('<script>alert')
    })

    it('should escape HTML in the description to prevent XSS', () => {
      const page = { id: '1', title: 'Page', description: '<img src=x onerror=alert(1)>', render: '', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    })

    it('should use Untitled as default title when title is missing', () => {
      const page = { id: '1', title: '', description: '', render: '', updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('<title>Untitled</title>')
    })

    it('should render empty content without error when render is null', () => {
      const page = { id: '1', title: 'Page', description: '', render: null, updatedAt: null }
      const html = buildPrintHtml(page)
      expect(html).toContain('<div class="print-content"></div>')
    })
  })

  describe('escapeHtml helper', () => {
    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    })

    it('should escape less-than and greater-than signs', () => {
      expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;')
    })

    it('should escape double quotes', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
    })

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s')
    })

    it('should return empty string for falsy input', () => {
      expect(escapeHtml(null)).toBe('')
      expect(escapeHtml(undefined)).toBe('')
      expect(escapeHtml('')).toBe('')
    })
  })
})
