import express from 'express'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})

/**
 * Strip HTML tags from content for plain-text AI consumption
 */
function stripHtml (html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

/**
 * Convert HTML to Markdown for structured AI consumption
 */
function htmlToMarkdown (html) {
  if (!html) return ''
  try {
    return turndown.turndown(html)
  } catch {
    return stripHtml(html)
  }
}

/**
 * API Key authentication middleware
 */
function authenticateApiKey (req, res, next) {
  // Check if API key is configured
  const configuredKey = WIKI.config.api?.mcpApiKey
  if (!configuredKey) {
    // No API key configured — allow public access (backward compatible)
    return next()
  }

  const providedKey = req.headers['x-api-key'] || req.query.apiKey
  if (!providedKey) {
    return res.status(401).json({ error: 'API key required. Provide via X-API-Key header or ?apiKey= query parameter.' })
  }
  if (providedKey !== configuredKey) {
    return res.status(403).json({ error: 'Invalid API key.' })
  }
  next()
}

export default function () {
  const router = express.Router()

  // Apply API key auth to all MCP routes
  router.use(authenticateApiKey)

  /**
   * GET /api/mcp/manifest
   * MCP-compatible manifest describing available capabilities
   */
  router.get('/manifest', (req, res) => {
    res.json({
      name: 'CloudWiki',
      description: 'Knowledge base content API for AI agents',
      version: '2.0.0',
      capabilities: {
        pages: {
          list: true,
          read: true,
          search: true,
          formats: ['markdown', 'plain', 'html']
        }
      },
      endpoints: {
        manifest: { method: 'GET', path: '/api/mcp/manifest' },
        list: {
          method: 'GET',
          path: '/api/mcp/pages',
          params: {
            page: 'Page number (default: 1)',
            limit: 'Results per page (default: 25, max: 100)',
            path: 'Filter by path prefix (e.g. nees/transversal)',
            locale: 'Filter by locale (e.g. pt, en)',
            tags: 'Filter by tags (comma-separated)',
            updatedAfter: 'Only pages updated after this ISO date'
          }
        },
        read: {
          method: 'GET',
          path: '/api/mcp/pages/:id',
          params: {
            format: 'Content format: markdown (default), plain, html'
          }
        },
        readByPath: {
          method: 'GET',
          path: '/api/mcp/pages/by-path/:path',
          params: {
            format: 'Content format: markdown (default), plain, html'
          }
        },
        bulk: {
          method: 'POST',
          path: '/api/mcp/pages/bulk',
          body: '{ "ids": ["uuid1", "uuid2", ...], "format": "markdown" }'
        },
        search: {
          method: 'GET',
          path: '/api/mcp/search',
          params: {
            q: 'Search query (required)',
            page: 'Page number (default: 1)',
            limit: 'Results per page (default: 25, max: 100)',
            path: 'Filter by path prefix',
            locale: 'Filter by locale'
          }
        }
      },
      authentication: {
        type: 'api-key',
        header: 'X-API-Key',
        queryParam: 'apiKey',
        note: 'If no API key is configured on the server, all endpoints are public.'
      }
    })
  })

  /**
   * GET /api/mcp/pages
   * List published pages with metadata, pagination, and filters
   */
  router.get('/pages', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const page = Math.max(1, parseInt(req.query.page) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25))
      const offset = (page - 1) * limit

      let query = WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })

      // Filters
      if (req.query.path) {
        query = query.where('path', 'ILIKE', `${req.query.path}%`)
      }
      if (req.query.locale) {
        query = query.where('locale', req.query.locale)
      }
      if (req.query.tags) {
        const tags = req.query.tags.split(',').map(t => t.trim()).filter(Boolean)
        if (tags.length > 0) {
          query = query.where('tags', '@>', tags)
        }
      }
      if (req.query.updatedAfter) {
        query = query.where('updatedAt', '>', req.query.updatedAfter)
      }

      // Count total
      const countResult = await query.clone().count('* as total').first()
      const total = parseInt(countResult?.total || 0)

      // Fetch page
      const pages = await query
        .select('id', 'path', 'title', 'description', 'locale', 'icon', 'tags', 'updatedAt', 'createdAt')
        .orderBy('path')
        .offset(offset)
        .limit(limit)

      res.json({
        pages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + limit < total
        }
      })
    } catch (err) {
      WIKI.logger.warn(`MCP /pages failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/pages/:id
   * Get full page content by UUID
   */
  router.get('/pages/:id', async (req, res) => {
    // Skip if it looks like a sub-path (e.g. /pages/by-path or /pages/bulk)
    if (req.params.id === 'by-path' || req.params.id === 'bulk') return

    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const page = await WIKI.db.knex('pages')
        .where({ id: req.params.id, siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'content', 'render', 'locale', 'icon', 'tags', 'editor', 'createdAt', 'updatedAt')
        .first()

      if (!page) return res.status(404).json({ error: 'Page not found' })

      const format = req.query.format || 'markdown'
      const rawHtml = page.render || page.content || ''
      let content
      switch (format) {
        case 'html':
          content = rawHtml
          break
        case 'plain':
          content = stripHtml(rawHtml)
          break
        case 'markdown':
        default:
          content = htmlToMarkdown(rawHtml)
          break
      }

      res.json({
        id: page.id,
        path: page.path,
        title: page.title,
        description: page.description,
        content,
        format,
        locale: page.locale,
        icon: page.icon,
        tags: page.tags || [],
        editor: page.editor,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt
      })
    } catch (err) {
      WIKI.logger.warn(`MCP /pages/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/pages/by-path/*
   * Get full page content by path (e.g. /api/mcp/pages/by-path/nees/transversal/arquitetura)
   */
  router.get('/pages/by-path/*', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const pagePath = req.params[0] || ''
      const page = await WIKI.db.knex('pages')
        .where({ path: pagePath, siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'content', 'render', 'locale', 'icon', 'tags', 'editor', 'createdAt', 'updatedAt')
        .first()

      if (!page) return res.status(404).json({ error: 'Page not found' })

      const format = req.query.format || 'markdown'
      const rawHtml = page.render || page.content || ''
      let content
      switch (format) {
        case 'html':
          content = rawHtml
          break
        case 'plain':
          content = stripHtml(rawHtml)
          break
        case 'markdown':
        default:
          content = htmlToMarkdown(rawHtml)
          break
      }

      res.json({
        id: page.id,
        path: page.path,
        title: page.title,
        description: page.description,
        content,
        format,
        locale: page.locale,
        icon: page.icon,
        tags: page.tags || [],
        editor: page.editor,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt
      })
    } catch (err) {
      WIKI.logger.warn(`MCP /pages/by-path failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/pages/bulk
   * Read multiple pages at once
   * Body: { "ids": ["uuid1", "uuid2"], "format": "markdown" }
   */
  router.post('/pages/bulk', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const ids = req.body?.ids
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Request body must contain "ids" array.' })
      }
      if (ids.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 pages per bulk request.' })
      }

      const format = req.body?.format || 'markdown'

      const pages = await WIKI.db.knex('pages')
        .whereIn('id', ids)
        .where({ siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'content', 'render', 'locale', 'icon', 'tags', 'editor', 'createdAt', 'updatedAt')

      const results = pages.map(page => {
        const rawHtml = page.render || page.content || ''
        let content
        switch (format) {
          case 'html':
            content = rawHtml
            break
          case 'plain':
            content = stripHtml(rawHtml)
            break
          case 'markdown':
          default:
            content = htmlToMarkdown(rawHtml)
            break
        }
        return {
          id: page.id,
          path: page.path,
          title: page.title,
          description: page.description,
          content,
          format,
          locale: page.locale,
          icon: page.icon,
          tags: page.tags || [],
          editor: page.editor,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt
        }
      })

      res.json({
        pages: results,
        requested: ids.length,
        found: results.length
      })
    } catch (err) {
      WIKI.logger.warn(`MCP /pages/bulk failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/search?q=query
   * Search published pages with FTS, pagination, and filters
   */
  router.get('/search', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const q = (req.query.q || '').trim()
      if (!q) return res.status(400).json({ error: 'Query parameter "q" is required.' })

      const page = Math.max(1, parseInt(req.query.page) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25))
      const offset = (page - 1) * limit

      // Use PostgreSQL full-text search when available
      let query = WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })

      if (req.query.path) {
        query = query.where('path', 'ILIKE', `${req.query.path}%`)
      }
      if (req.query.locale) {
        query = query.where('locale', req.query.locale)
      }

      // Text search across title, description, path, and searchContent
      const searchTerm = `%${q.toLowerCase()}%`
      query = query.where(builder => {
        builder
          .whereRaw('LOWER(title) LIKE ?', [searchTerm])
          .orWhereRaw('LOWER(description) LIKE ?', [searchTerm])
          .orWhereRaw('LOWER(path) LIKE ?', [searchTerm])
          .orWhereRaw('LOWER("searchContent") LIKE ?', [searchTerm])
      })

      const countResult = await query.clone().count('* as total').first()
      const total = parseInt(countResult?.total || 0)

      const pages = await query
        .select('id', 'path', 'title', 'description', 'locale', 'icon', 'tags', 'updatedAt')
        .orderBy('updatedAt', 'desc')
        .offset(offset)
        .limit(limit)

      res.json({
        query: q,
        pages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + limit < total
        }
      })
    } catch (err) {
      WIKI.logger.warn(`MCP /search failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
