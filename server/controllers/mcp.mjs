import express from 'express'

/**
 * Strip HTML tags from content for plain-text AI consumption
 */
function stripHtml (html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

export default function () {
  const router = express.Router()

  /**
   * GET /api/mcp/manifest
   * MCP-compatible manifest describing available capabilities
   */
  router.get('/manifest', (req, res) => {
    res.json({
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
    })
  })

  /**
   * GET /api/mcp/pages
   * List all published pages with metadata
   */
  router.get('/pages', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const pages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'locale', 'updatedAt')
        .orderBy('path')

      res.json({ pages })
    } catch (err) {
      WIKI.logger.warn(`MCP /pages failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/pages/:id
   * Get full page content by ID
   */
  router.get('/pages/:id', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const page = await WIKI.db.knex('pages')
        .where({ id: req.params.id, siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'content', 'render', 'locale', 'tags', 'updatedAt')
        .first()

      if (!page) return res.status(404).json({ error: 'Page not found' })

      const plainContent = stripHtml(page.render || page.content)

      res.json({
        id: page.id,
        path: page.path,
        title: page.title,
        description: page.description,
        content: plainContent,
        locale: page.locale,
        tags: page.tags || [],
        updatedAt: page.updatedAt
      })
    } catch (err) {
      WIKI.logger.warn(`MCP /pages/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/search?q=query
   * Search published pages by title, description, or content
   */
  router.get('/search', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const q = (req.query.q || '').trim().toLowerCase()

      const pages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'locale', 'updatedAt')
        .orderBy('path')

      const filtered = q
        ? pages.filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.path || '').toLowerCase().includes(q)
          )
        : pages

      res.json({ pages: filtered })
    } catch (err) {
      WIKI.logger.warn(`MCP /search failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
