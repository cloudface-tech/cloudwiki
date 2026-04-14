import express from 'express'
import TurndownService from 'turndown'
import { generatePageHash, markdownToHtml, stripHtml, buildPageDefaults, uuidv4 } from '../services/page.mjs'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})

// stripHtml imported from services/page.mjs

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

// markdownToHtml imported from services/page.mjs

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

  const providedKey = req.headers['x-api-key']
  if (!providedKey) {
    return res.status(401).json({ error: 'API key required. Provide via X-API-Key header.' })
  }
  if (providedKey !== configuredKey) {
    return res.status(403).json({ error: 'Invalid API key.' })
  }
  next()
}

/**
 * Simple cosine similarity between two vectors
 */
function cosineSimilarity (a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0; let magA = 0; let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1)
}

/**
 * Get embedding pipeline (lazy-loaded)
 */
let pipelineInstance = null
async function getEmbeddingPipeline () {
  if (pipelineInstance) return pipelineInstance
  try {
    const { pipeline } = await import('@xenova/transformers')
    pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    return pipelineInstance
  } catch {
    return null
  }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding (text) {
  const pipe = await getEmbeddingPipeline()
  if (!pipe) return null
  const output = await pipe(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

/**
 * Ensure comments and page_permissions tables exist
 */
async function ensureTables () {
  const knex = WIKI.db.knex
  if (typeof knex?.schema?.hasTable !== 'function') return

  // comments table already exists in Wiki.js with columns:
  // id, replyTo, content, render, name, email, ip, createdAt, updatedAt, pageId, authorId
  // No need to create it

  // pagePermissions table already exists in Wiki.js
}

/**
 * Simple in-memory rate limiter
 */
function rateLimit (maxRequests, windowMs) {
  const hits = new Map()
  return (req, res, next) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const record = hits.get(key) || { count: 0, resetAt: now + windowMs }
    if (now > record.resetAt) {
      record.count = 0
      record.resetAt = now + windowMs
    }
    record.count++
    hits.set(key, record)
    if (record.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' })
    }
    next()
  }
}

const askRateLimit = rateLimit(20, 60000) // 20 req/min per IP

export default function () {
  const router = express.Router()

  // Ensure tables exist on first request
  let tablesReady = false
  router.use(async (req, res, next) => {
    if (!tablesReady) {
      try {
        await ensureTables()
      } catch (err) {
        WIKI.logger.warn(`MCP ensureTables: ${err.message}`)
      }
      tablesReady = true
    }
    next()
  })

  // Apply API key auth to all MCP routes
  router.use(authenticateApiKey)

  /**
   * GET /api/mcp/recent
   * List recently updated pages
   */
  router.get('/recent', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10))

      const pages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'locale', 'icon', 'updatedAt')
        .orderBy('updatedAt', 'desc')
        .limit(limit)

      res.json({ pages, total: pages.length })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /recent failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/seed-templates
   * Create starter templates (idempotent)
   */
  router.post('/seed-templates', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const templates = [
        {
          path: 'templates/ata-de-reuniao',
          title: 'Ata de Reuniao',
          description: 'Template para atas de reuniao',
          content: '# Ata de Reuniao\n\n**Data:** \n**Participantes:** \n\n## Pauta\n\n1. \n\n## Decisoes\n\n- \n\n## Proximos Passos\n\n| Acao | Responsavel | Prazo |\n|------|-------------|-------|\n| | | |\n'
        },
        {
          path: 'templates/adr',
          title: 'ADR - Decisao Tecnica',
          description: 'Architecture Decision Record',
          content: '# ADR-000: Titulo da Decisao\n\n**Status:** Proposta | Aceita | Depreciada\n**Data:** \n**Autor:** \n\n## Contexto\n\nDescreva o contexto e problema.\n\n## Decisao\n\nDescreva a decisao tomada.\n\n## Consequencias\n\n### Positivas\n- \n\n### Negativas\n- \n\n## Alternativas Consideradas\n\n1. **Alternativa A** — descricao\n2. **Alternativa B** — descricao\n'
        },
        {
          path: 'templates/runbook',
          title: 'Runbook Operacional',
          description: 'Guia passo-a-passo para operacoes',
          content: '# Runbook: Nome do Procedimento\n\n**Severidade:** Alta | Media | Baixa\n**Tempo estimado:** X min\n**Ultimo teste:** \n\n## Pre-requisitos\n\n- [ ] Acesso ao sistema X\n- [ ] Credenciais configuradas\n\n## Passos\n\n### 1. Verificacao inicial\n\n```bash\n# comando aqui\n```\n\n### 2. Execucao\n\n```bash\n# comando aqui\n```\n\n### 3. Validacao\n\n- [ ] Verificar logs\n- [ ] Testar endpoint\n\n## Rollback\n\nCaso algo de errado:\n\n```bash\n# comando de rollback\n```\n\n## Contatos\n\n| Papel | Nome | Contato |\n|-------|------|--------|\n| Oncall | | |\n'
        },
        {
          path: 'templates/onboarding',
          title: 'Onboarding de Novo Membro',
          description: 'Checklist para onboarding',
          content: '# Onboarding: Nome do Membro\n\n**Data de inicio:** \n**Time:** \n**Buddy:** \n\n## Dia 1\n\n- [ ] Boas-vindas e apresentacao do time\n- [ ] Configurar acessos (email, Slack, Git)\n- [ ] Ler documentacao base\n- [ ] Setup do ambiente de desenvolvimento\n\n## Semana 1\n\n- [ ] Conhecer a arquitetura do projeto\n- [ ] Primeiro PR (tarefa simples)\n- [ ] 1:1 com lider tecnico\n\n## Mes 1\n\n- [ ] Completar tarefa significativa\n- [ ] Participar de code review\n- [ ] Feedback 30 dias\n\n## Links Uteis\n\n- [Arquitetura]()\n- [Guia de Contribuicao]()\n- [Padroes de Codigo]()\n'
        },
        {
          path: 'templates/projeto',
          title: 'Documentacao de Projeto',
          description: 'Template para documentar projetos',
          content: '# Projeto: Nome\n\n**Status:** Em desenvolvimento | Producao | Depreciado\n**Time:** \n**Repositorio:** \n\n## Visao Geral\n\nDescreva o objetivo do projeto.\n\n## Arquitetura\n\n```mermaid\ngraph TD\n  A[Frontend] --> B[API]\n  B --> C[Database]\n```\n\n## Stack Tecnica\n\n| Componente | Tecnologia |\n|-----------|------------|\n| Frontend | |\n| Backend | |\n| Database | |\n| Infra | |\n\n## Como Rodar\n\n```bash\n# instrucoes aqui\n```\n\n## Endpoints\n\n| Metodo | Path | Descricao |\n|--------|------|----------|\n| GET | /api/v1/ | |\n\n## Decisoes Tecnicas\n\n- [[ADR-001]]\n'
        }
      ]

      const created = []
      for (const tpl of templates) {
        const existing = await WIKI.db.knex('pages')
          .where({ path: tpl.path, siteId: site.id })
          .first()
        if (existing) {
          created.push({ path: tpl.path, status: 'exists' })
          continue
        }

        const now = new Date().toISOString()
        const pageId = uuidv4()
        await WIKI.db.knex('pages').insert({
          id: pageId,
          path: tpl.path,
          hash: generatePageHash(tpl.path, 'pt'),
          title: tpl.title,
          description: tpl.description,
          content: tpl.content,
          render: markdownToHtml(tpl.content),
          searchContent: tpl.content,
          locale: 'pt',
          icon: 'las la-file-alt',
          tags: ['template'],
          editor: 'markdown',
          contentType: 'markdown',
          publishState: 'published',
          config: {},
          relations: [],
          scripts: {},
          historyData: {},
          isBrowsable: true,
          isSearchable: true,
          ratingScore: 0,
          ratingCount: 0,
          authorId: WIKI.config?.api?.mcpDefaultAuthorId || '3431b098-9a8a-4e25-8ffb-2c95d5f60df4',
          creatorId: WIKI.config?.api?.mcpDefaultAuthorId || '3431b098-9a8a-4e25-8ffb-2c95d5f60df4',
          ownerId: WIKI.config?.api?.mcpDefaultAuthorId || '3431b098-9a8a-4e25-8ffb-2c95d5f60df4',
          siteId: site.id,
          createdAt: now,
          updatedAt: now
        })
        created.push({ path: tpl.path, status: 'created', id: pageId })
      }

      res.json({ templates: created, total: created.length })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /seed-templates failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/migrate
   * Run data integrity fixes (idempotent)
   */
  router.post('/migrate', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const results = []

      // NOTE: locale migration removed — Wiki.js site config uses 'en' as primary,
      // changing page/tree locales without also updating site config breaks routing.
      // Locale changes should be done through the Wiki.js admin UI, not via migration.

      // Fix double-slash paths
      const doubleSlash = await WIKI.db.knex('pages')
        .where({ siteId: site.id })
        .whereRaw("path LIKE '%//%'")
        .select('id', 'path')
      for (const page of doubleSlash) {
        const fixedPath = page.path.replace(/\/\//g, '/')
        await WIKI.db.knex('pages').where({ id: page.id }).update({
          path: fixedPath,
          hash: generatePageHash(fixedPath, 'pt')
        })
      }
      results.push({ action: 'fix-double-slash-paths', fixed: doubleSlash.length })

      // Unpublish test pages
      const testUnpub = await WIKI.db.knex('pages')
        .where({ siteId: site.id })
        .where('path', 'ILIKE', 'teste/%')
        .update({ publishState: 'draft' })
      results.push({ action: 'unpublish-test-pages', updated: testUnpub })

      res.json({ migrated: true, results })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /migrate failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/manifest
   * MCP-compatible manifest describing available capabilities
   */
  router.get('/manifest', (req, res) => {
    res.json({
      name: 'CloudWiki',
      description: 'Knowledge base content API for AI agents',
      version: '3.0.0',
      capabilities: {
        pages: {
          list: true,
          read: true,
          search: true,
          create: true,
          update: true,
          delete: true,
          formats: ['markdown', 'plain', 'html']
        },
        templates: {
          list: true,
          createFrom: true
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
          path: '/api/mcp/page-by-path',
          params: {
            path: 'Page path (required, e.g. nees/transversal/arquitetura)',
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
        },
        create: {
          method: 'POST',
          path: '/api/mcp/pages',
          body: '{ "title": "string (required)", "path": "string (required)", "content": "string", "format": "markdown|html", "description": "string", "locale": "string", "tags": ["string"], "icon": "string" }'
        },
        update: {
          method: 'PUT',
          path: '/api/mcp/pages/:id',
          body: '{ "title?": "string", "path?": "string", "content?": "string", "format?": "markdown|html", "description?": "string", "locale?": "string", "tags?": ["string"], "publishState?": "string" }'
        },
        delete: {
          method: 'DELETE',
          path: '/api/mcp/pages/:id'
        },
        templates: {
          method: 'GET',
          path: '/api/mcp/templates'
        },
        createFromTemplate: {
          method: 'POST',
          path: '/api/mcp/templates/:id/create',
          body: '{ "title": "string (required)", "path": "string (required)", "locale?": "string", "tags?": ["string"] }'
        }
      },
      authentication: {
        type: 'api-key',
        header: 'X-API-Key',
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
   * GET /api/mcp/page-by-path?path=nees/transversal/arquitetura
   * Get full page content by path
   */
  router.get('/page-by-path', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const pagePath = req.query.path || ''
      if (!pagePath) return res.status(400).json({ error: 'Query parameter "path" is required.' })
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
        .select('id', 'path', 'title', 'description', 'locale', 'icon', 'tags', 'updatedAt', 'searchContent')
        .orderBy('updatedAt', 'desc')
        .offset(offset)
        .limit(limit)

      // Generate excerpts with keyword context
      const qLower = q.toLowerCase()
      const pagesWithExcerpt = pages.map(p => {
        const text = p.searchContent || p.description || ''
        let excerpt = ''
        const idx = text.toLowerCase().indexOf(qLower)
        if (idx >= 0) {
          const start = Math.max(0, idx - 80)
          const end = Math.min(text.length, idx + q.length + 120)
          excerpt = (start > 0 ? '...' : '') + text.slice(start, end).trim() + (end < text.length ? '...' : '')
        } else {
          excerpt = text.slice(0, 200).trim() + (text.length > 200 ? '...' : '')
        }
        const { searchContent, ...rest } = p
        return { ...rest, excerpt }
      })

      res.json({
        query: q,
        pages: pagesWithExcerpt,
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

  // =========================================================================
  // WRITE ENDPOINTS
  // =========================================================================

  /**
   * POST /api/mcp/pages
   * Create a new page
   * Body: { title, path, content, format?, description?, locale?, tags?, icon?, editor? }
   */
  router.post('/pages', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const { title, path: pagePath, content, format, description, locale, tags, icon, editor } = req.body || {}

      if (!title || !pagePath) {
        return res.status(400).json({ error: 'Fields "title" and "path" are required.' })
      }

      // Check for duplicate path
      const existing = await WIKI.db.knex('pages')
        .where({ path: pagePath, siteId: site.id })
        .first()
      if (existing) {
        return res.status(409).json({ error: `Page already exists at path "${pagePath}".` })
      }

      // Convert content based on format
      const inputFormat = format || 'html'
      let htmlContent = ''
      if (content) {
        htmlContent = inputFormat === 'markdown' ? markdownToHtml(content) : content
      }

      const now = new Date().toISOString()
      const pageId = uuidv4()

      const pageLocale = locale || 'en'
      const pageEditor = editor || (inputFormat === 'markdown' ? 'markdown' : 'html')

      const newPage = {
        id: pageId,
        path: pagePath,
        hash: generatePageHash(pagePath, pageLocale),
        title,
        description: description || '',
        content: htmlContent,
        render: htmlContent,
        searchContent: stripHtml(htmlContent),
        locale: pageLocale,
        icon: icon || '',
        tags: tags || [],
        editor: pageEditor,
        contentType: pageEditor === 'markdown' ? 'markdown' : 'html',
        publishState: 'published',
        ...buildPageDefaults(site.id),
        createdAt: now,
        updatedAt: now
      }

      await WIKI.db.knex('pages').insert(newPage)

      res.status(201).json({
        id: pageId,
        path: pagePath,
        title,
        description: newPage.description,
        locale: newPage.locale,
        icon: newPage.icon,
        tags: newPage.tags,
        editor: newPage.editor,
        createdAt: now,
        updatedAt: now
      })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /pages failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * PUT /api/mcp/pages/:id
   * Update an existing page
   * Body: { title?, path?, content?, format?, description?, locale?, tags?, icon?, editor?, publishState? }
   */
  router.put('/pages/:id', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const page = await WIKI.db.knex('pages')
        .where({ id: req.params.id, siteId: site.id })
        .first()
      if (!page) return res.status(404).json({ error: 'Page not found' })

      const updates = {}
      const body = req.body || {}

      if (body.title !== undefined) updates.title = body.title
      if (body.path !== undefined) {
        // Check path uniqueness if changing
        if (body.path !== page.path) {
          const dup = await WIKI.db.knex('pages')
            .where({ path: body.path, siteId: site.id })
            .whereNot('id', req.params.id)
            .first()
          if (dup) {
            return res.status(409).json({ error: `Path "${body.path}" is already in use.` })
          }
        }
        updates.path = body.path
        updates.hash = generatePageHash(body.path, body.locale || page.locale)
      }
      if (body.description !== undefined) updates.description = body.description
      if (body.locale !== undefined) updates.locale = body.locale
      if (body.icon !== undefined) updates.icon = body.icon
      if (body.tags !== undefined) updates.tags = body.tags
      if (body.editor !== undefined) updates.editor = body.editor
      if (body.publishState !== undefined) updates.publishState = body.publishState

      if (body.content !== undefined) {
        const inputFormat = body.format || 'html'
        const htmlContent = inputFormat === 'markdown' ? markdownToHtml(body.content) : body.content
        updates.content = htmlContent
        updates.render = htmlContent
        updates.searchContent = stripHtml(htmlContent)
      }

      updates.updatedAt = new Date().toISOString()

      await WIKI.db.knex('pages')
        .where({ id: req.params.id })
        .update(updates)

      const updated = await WIKI.db.knex('pages')
        .where({ id: req.params.id })
        .select('id', 'path', 'title', 'description', 'locale', 'icon', 'tags', 'editor', 'publishState', 'createdAt', 'updatedAt')
        .first()

      res.json(updated)
    } catch (err) {
      WIKI.logger.warn(`MCP PUT /pages/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * DELETE /api/mcp/pages/:id
   * Delete a page
   */
  router.delete('/pages/:id', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const page = await WIKI.db.knex('pages')
        .where({ id: req.params.id, siteId: site.id })
        .first()
      if (!page) return res.status(404).json({ error: 'Page not found' })

      // Delete dependent records first (FK constraints)
      await WIKI.db.knex('comments').where({ pageId: req.params.id }).del()
      await WIKI.db.knex('pagePermissions').where({ pageId: req.params.id }).del()
      await WIKI.db.knex('pageLinks').where({ pageId: req.params.id }).orWhere({ targetId: req.params.id }).del().catch(() => {})
      await WIKI.db.knex('pageHistory').where({ pageId: req.params.id }).del().catch(() => {})

      await WIKI.db.knex('pages')
        .where({ id: req.params.id })
        .del()

      res.json({ deleted: true, id: req.params.id, path: page.path })
    } catch (err) {
      WIKI.logger.warn(`MCP DELETE /pages/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // =========================================================================
  // TEMPLATES
  // =========================================================================

  /**
   * GET /api/mcp/templates
   * List available page templates
   */
  router.get('/templates', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const templates = await WIKI.db.knex('pages')
        .where({ siteId: site.id })
        .where(function () {
          this.where('path', 'ILIKE', 'templates/%')
            .orWhereRaw("tags @> ARRAY['template']::text[]")
        })
        .select('id', 'path', 'title', 'description', 'locale', 'icon', 'tags', 'editor', 'updatedAt')
        .orderBy('title')

      res.json({ templates, total: templates.length })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /templates failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/templates/:id/create
   * Create a new page from a template
   * Body: { title, path, locale?, tags?, description? }
   */
  router.post('/templates/:id/create', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const template = await WIKI.db.knex('pages')
        .where({ id: req.params.id, siteId: site.id })
        .select('content', 'render', 'editor', 'contentType', 'icon', 'tags')
        .first()
      if (!template) return res.status(404).json({ error: 'Template not found' })

      const { title, path: pagePath, locale, tags, description } = req.body || {}
      if (!title || !pagePath) {
        return res.status(400).json({ error: 'Fields "title" and "path" are required.' })
      }

      const existing = await WIKI.db.knex('pages')
        .where({ path: pagePath, siteId: site.id })
        .first()
      if (existing) {
        return res.status(409).json({ error: `Page already exists at path "${pagePath}".` })
      }

      const now = new Date().toISOString()
      const pageId = uuidv4()

      const tplLocale = locale || 'en'

      const newPage = {
        id: pageId,
        path: pagePath,
        hash: generatePageHash(pagePath, tplLocale),
        title,
        description: description || '',
        content: template.content,
        render: template.render,
        searchContent: stripHtml(template.render || template.content || ''),
        locale: tplLocale,
        icon: template.icon || '',
        tags: tags || template.tags || [],
        editor: template.editor,
        contentType: template.contentType || 'html',
        publishState: 'published',
        ...buildPageDefaults(site.id),
        createdAt: now,
        updatedAt: now
      }

      await WIKI.db.knex('pages').insert(newPage)

      res.status(201).json({
        id: pageId,
        path: pagePath,
        title,
        description: newPage.description,
        locale: newPage.locale,
        icon: newPage.icon,
        tags: newPage.tags,
        editor: newPage.editor,
        templateId: req.params.id,
        createdAt: now,
        updatedAt: now
      })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /templates/:id/create failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // =========================================================================
  // COMMENTS
  // =========================================================================

  /**
   * GET /api/mcp/pages/:pageId/comments
   * List comments for a page (threaded)
   */
  router.get('/pages/:pageId/comments', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const comments = await WIKI.db.knex('comments')
        .where({ pageId: req.params.pageId })
        .select('id', 'pageId', 'replyTo', 'name', 'email', 'content', 'render', 'createdAt', 'updatedAt')
        .orderBy('createdAt', 'asc')

      // Build tree: top-level + replies
      const topLevel = comments.filter(c => !c.replyTo).map(c => ({ ...c, authorName: c.name, authorEmail: c.email }))
      const replies = comments.filter(c => c.replyTo).map(c => ({ ...c, authorName: c.name, authorEmail: c.email }))
      const threaded = topLevel.map(c => ({
        ...c,
        replies: replies.filter(r => r.replyTo === c.id)
      }))

      res.json({ comments: threaded, total: comments.length })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /pages/:pageId/comments failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/pages/:pageId/comments
   * Create a comment on a page
   * Body: { authorName, content, authorEmail?, parentId?, mentions? }
   */
  router.post('/pages/:pageId/comments', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      // Verify page exists
      const page = await WIKI.db.knex('pages')
        .where({ id: req.params.pageId, siteId: site.id })
        .first()
      if (!page) return res.status(404).json({ error: 'Page not found' })

      const { authorName, content, authorEmail, parentId } = req.body || {}
      if (!authorName || !content) {
        return res.status(400).json({ error: 'Fields "authorName" and "content" are required.' })
      }

      // Verify parent exists if replying
      if (parentId) {
        const parent = await WIKI.db.knex('comments')
          .where({ id: parentId, pageId: req.params.pageId })
          .first()
        if (!parent) return res.status(404).json({ error: 'Parent comment not found' })
      }

      const now = new Date().toISOString()

      const commentId = uuidv4()
      const newComment = {
        id: commentId,
        replyTo: parentId || null,
        pageId: req.params.pageId,
        content,
        render: content,
        name: authorName,
        email: authorEmail || '',
        ip: req.ip || '0.0.0.0',
        authorId: buildPageDefaults(site.id).authorId,
        createdAt: now,
        updatedAt: now
      }

      await WIKI.db.knex('comments').insert(newComment)

      res.status(201).json({
        id: commentId,
        pageId: req.params.pageId,
        parentId: newComment.replyTo,
        authorName,
        content,
        createdAt: now
      })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /pages/:pageId/comments failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * PUT /api/mcp/comments/:id
   * Update a comment
   * Body: { content?, mentions? }
   */
  router.put('/comments/:id', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const comment = await WIKI.db.knex('comments')
        .where({ id: req.params.id })
        .first()
      if (!comment) return res.status(404).json({ error: 'Comment not found' })

      const updates = {}
      if (req.body.content !== undefined) {
        updates.content = req.body.content
        updates.render = req.body.content
      }
      updates.updatedAt = new Date().toISOString()

      await WIKI.db.knex('comments')
        .where({ id: req.params.id })
        .update(updates)

      res.json({ id: req.params.id, ...updates })
    } catch (err) {
      WIKI.logger.warn(`MCP PUT /comments/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * DELETE /api/mcp/comments/:id
   * Delete a comment (and its replies)
   */
  router.delete('/comments/:id', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const comment = await WIKI.db.knex('comments')
        .where({ id: req.params.id })
        .first()
      if (!comment) return res.status(404).json({ error: 'Comment not found' })

      // Delete replies first, then parent
      await WIKI.db.knex('comments')
        .where({ replyTo: req.params.id })
        .del()
      await WIKI.db.knex('comments')
        .where({ id: req.params.id })
        .del()

      res.json({ deleted: true, id: req.params.id })
    } catch (err) {
      WIKI.logger.warn(`MCP DELETE /comments/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // =========================================================================
  // PAGE PERMISSIONS
  // =========================================================================

  /**
   * GET /api/mcp/pages/:pageId/permissions
   * List permissions for a page
   */
  router.get('/pages/:pageId/permissions', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const permissions = await WIKI.db.knex('pagePermissions')
        .where({ pageId: req.params.pageId, siteId: site.id })
        .select('id', 'pageId', 'subjectType', 'subjectId', 'level', 'createdAt')
        .orderBy('createdAt')

      res.json({ permissions, total: permissions.length })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /pages/:pageId/permissions failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/pages/:pageId/permissions
   * Add a permission to a page
   * Body: { subjectType: 'user'|'group', subjectId, level: 'read'|'write'|'admin' }
   */
  router.post('/pages/:pageId/permissions', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const { subjectType, subjectId, level } = req.body || {}
      if (!subjectType || !subjectId || !level) {
        return res.status(400).json({ error: 'Fields "subjectType", "subjectId", and "level" are required.' })
      }
      if (!['user', 'group'].includes(subjectType)) {
        return res.status(400).json({ error: 'subjectType must be "user" or "group".' })
      }
      if (!['read', 'write', 'admin'].includes(level)) {
        return res.status(400).json({ error: 'level must be "read", "write", or "admin".' })
      }

      // Verify page exists
      const page = await WIKI.db.knex('pages')
        .where({ id: req.params.pageId, siteId: site.id })
        .first()
      if (!page) return res.status(404).json({ error: 'Page not found' })

      const permId = uuidv4()
      const now = new Date().toISOString()

      // Upsert: update level if permission already exists
      const existing = await WIKI.db.knex('pagePermissions')
        .where({ pageId: req.params.pageId, subjectType, subjectId, siteId: site.id })
        .first()

      if (existing) {
        await WIKI.db.knex('pagePermissions')
          .where({ id: existing.id })
          .update({ level })
        res.json({ id: existing.id, pageId: req.params.pageId, subjectType, subjectId, level, updated: true })
      } else {
        await WIKI.db.knex('pagePermissions').insert({
          id: permId,
          pageId: req.params.pageId,
          siteId: site.id,
          subjectType,
          subjectId,
          level,
          createdAt: now
        })
        res.status(201).json({ id: permId, pageId: req.params.pageId, subjectType, subjectId, level, created: true })
      }
    } catch (err) {
      WIKI.logger.warn(`MCP POST /pages/:pageId/permissions failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * DELETE /api/mcp/permissions/:id
   * Remove a permission
   */
  router.delete('/permissions/:id', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const perm = await WIKI.db.knex('pagePermissions')
        .where({ id: req.params.id, siteId: site.id })
        .first()
      if (!perm) return res.status(404).json({ error: 'Permission not found' })

      await WIKI.db.knex('pagePermissions')
        .where({ id: req.params.id })
        .del()

      res.json({ deleted: true, id: req.params.id })
    } catch (err) {
      WIKI.logger.warn(`MCP DELETE /permissions/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // =========================================================================
  // AI FEATURES
  // =========================================================================

  /**
   * POST /api/mcp/ask
   * Ask a question about wiki content — semantic search + context extraction
   * Body: { question, limit?, locale?, path? }
   */
  router.post('/ask', askRateLimit, express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const { question, locale, path: pathPrefix } = req.body || {}
      const limit = Math.min(10, Math.max(1, parseInt(req.body?.limit) || 5))

      if (!question) {
        return res.status(400).json({ error: 'Field "question" is required.' })
      }

      // Try semantic search with embeddings
      const queryEmbedding = await generateEmbedding(question)

      let query = WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('id', 'path', 'title', 'description', 'render', 'content', 'searchContent', 'updatedAt')

      if (locale) query = query.where('locale', locale)
      if (pathPrefix) query = query.where('path', 'ILIKE', `${pathPrefix}%`)

      const pages = await query.limit(200)

      let scored
      if (queryEmbedding) {
        // Semantic ranking: generate embeddings for each page and rank by similarity
        const results = []
        for (const page of pages) {
          const text = [page.title, page.description, (page.searchContent || '').slice(0, 500)].join(' ')
          const pageEmbedding = await generateEmbedding(text)
          const score = pageEmbedding ? cosineSimilarity(queryEmbedding, pageEmbedding) : 0
          results.push({ ...page, score })
        }
        scored = results.sort((a, b) => b.score - a.score).slice(0, limit)
      } else {
        // Fallback: keyword search
        const q = question.toLowerCase()
        scored = pages
          .map(page => {
            const text = [page.title, page.description, page.searchContent || ''].join(' ').toLowerCase()
            const words = q.split(/\s+/).filter(Boolean)
            const matches = words.filter(w => text.includes(w)).length
            return { ...page, score: matches / (words.length || 1) }
          })
          .filter(p => p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
      }

      const results = scored.map(page => ({
        id: page.id,
        path: page.path,
        title: page.title,
        description: page.description,
        score: Math.round(page.score * 1000) / 1000,
        excerpt: stripHtml(page.render || page.content || '').slice(0, 300),
        updatedAt: page.updatedAt
      }))

      res.json({
        question,
        results,
        total: results.length,
        method: queryEmbedding ? 'semantic' : 'keyword'
      })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /ask failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/mcp/translate
   * Translate a page's content to another locale
   * Body: { pageId, targetLocale, targetPath? }
   *
   * Creates a new page with translated content.
   * Translation is done via simple copy for now — in production,
   * integrate with a translation API (Google Translate, DeepL, etc.)
   */
  router.post('/translate', express.json(), async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const { pageId, targetLocale, targetPath } = req.body || {}
      if (!pageId || !targetLocale) {
        return res.status(400).json({ error: 'Fields "pageId" and "targetLocale" are required.' })
      }

      const sourcePage = await WIKI.db.knex('pages')
        .where({ id: pageId, siteId: site.id })
        .select('id', 'path', 'title', 'description', 'content', 'render', 'searchContent', 'editor', 'contentType', 'icon', 'tags')
        .first()
      if (!sourcePage) return res.status(404).json({ error: 'Source page not found' })

      const newPath = targetPath || `${targetLocale}/${sourcePage.path}`

      // Check if translated page already exists
      const existing = await WIKI.db.knex('pages')
        .where({ path: newPath, siteId: site.id })
        .first()
      if (existing) {
        return res.status(409).json({ error: `Page already exists at path "${newPath}". Use targetPath to specify a different path.` })
      }

      const now = new Date().toISOString()
      const translatedId = uuidv4()

      // Copy content — actual translation would be done here with an external API
      const translatedPage = {
        id: translatedId,
        path: newPath,
        hash: generatePageHash(newPath, targetLocale),
        title: sourcePage.title,
        description: sourcePage.description,
        content: sourcePage.content,
        render: sourcePage.render,
        searchContent: sourcePage.searchContent,
        locale: targetLocale,
        icon: sourcePage.icon || '',
        tags: [...(sourcePage.tags || []), `translated-from:${sourcePage.path}`],
        editor: sourcePage.editor,
        contentType: sourcePage.contentType || 'html',
        publishState: 'draft',
        ...buildPageDefaults(site.id),
        createdAt: now,
        updatedAt: now
      }

      await WIKI.db.knex('pages').insert(translatedPage)

      res.status(201).json({
        id: translatedId,
        path: newPath,
        title: sourcePage.title,
        locale: targetLocale,
        sourcePageId: pageId,
        sourcePath: sourcePage.path,
        publishState: 'draft',
        note: 'Page created as draft with source content. Translate the content manually or via an external API, then publish.',
        createdAt: now
      })
    } catch (err) {
      WIKI.logger.warn(`MCP POST /translate failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // =========================================================================
  // VERSION HISTORY
  // =========================================================================

  /**
   * GET /api/mcp/pages/:pageId/history
   * List version history for a page
   */
  router.get('/pages/:pageId/history', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))

      const versions = await WIKI.db.knex('pageHistory')
        .where({ pageId: req.params.pageId, siteId: site.id })
        .select('id', 'pageId', 'action', 'reason', 'title', 'description', 'path', 'editor', 'versionDate', 'createdAt', 'authorId')
        .orderBy('versionDate', 'desc')
        .limit(limit)

      res.json({ versions, total: versions.length })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /pages/:pageId/history failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/history/:id
   * Get full content of a specific version
   */
  router.get('/history/:id', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const version = await WIKI.db.knex('pageHistory')
        .where({ id: req.params.id, siteId: site.id })
        .first()
      if (!version) return res.status(404).json({ error: 'Version not found' })

      const format = req.query.format || 'markdown'
      const rawHtml = version.render || version.content || ''
      let content
      switch (format) {
        case 'html': content = rawHtml; break
        case 'plain': content = stripHtml(rawHtml); break
        default: content = htmlToMarkdown(rawHtml); break
      }

      res.json({
        id: version.id,
        pageId: version.pageId,
        action: version.action,
        reason: version.reason,
        title: version.title,
        path: version.path,
        content,
        format,
        versionDate: version.versionDate,
        authorId: version.authorId
      })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /history/:id failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/mcp/pages/:pageId/diff?from=versionId&to=versionId
   * Get diff between two versions (or version vs current)
   */
  router.get('/pages/:pageId/diff', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const fromId = req.query.from
      if (!fromId) return res.status(400).json({ error: 'Query parameter "from" (version ID) is required.' })

      const fromVersion = await WIKI.db.knex('pageHistory')
        .where({ id: fromId, siteId: site.id })
        .select('content', 'render', 'title', 'versionDate')
        .first()
      if (!fromVersion) return res.status(404).json({ error: 'From version not found' })

      let toContent, toTitle, toDate
      if (req.query.to) {
        const toVersion = await WIKI.db.knex('pageHistory')
          .where({ id: req.query.to, siteId: site.id })
          .select('content', 'render', 'title', 'versionDate')
          .first()
        if (!toVersion) return res.status(404).json({ error: 'To version not found' })
        toContent = stripHtml(toVersion.render || toVersion.content || '')
        toTitle = toVersion.title
        toDate = toVersion.versionDate
      } else {
        const current = await WIKI.db.knex('pages')
          .where({ id: req.params.pageId, siteId: site.id })
          .select('content', 'render', 'title', 'updatedAt')
          .first()
        if (!current) return res.status(404).json({ error: 'Current page not found' })
        toContent = stripHtml(current.render || current.content || '')
        toTitle = current.title
        toDate = current.updatedAt
      }

      const fromContent = stripHtml(fromVersion.render || fromVersion.content || '')

      // Simple line-by-line diff
      const fromLines = fromContent.split('\n')
      const toLines = toContent.split('\n')
      const changes = []
      const maxLen = Math.max(fromLines.length, toLines.length)
      for (let i = 0; i < maxLen; i++) {
        const fLine = fromLines[i] || ''
        const tLine = toLines[i] || ''
        if (fLine !== tLine) {
          if (fLine && !tLine) changes.push({ type: 'removed', line: i + 1, content: fLine })
          else if (!fLine && tLine) changes.push({ type: 'added', line: i + 1, content: tLine })
          else changes.push({ type: 'changed', line: i + 1, from: fLine, to: tLine })
        }
      }

      res.json({
        pageId: req.params.pageId,
        from: { id: fromId, title: fromVersion.title, date: fromVersion.versionDate },
        to: { id: req.query.to || 'current', title: toTitle, date: toDate },
        changes,
        totalChanges: changes.length
      })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /pages/:pageId/diff failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // =========================================================================
  // STALE CONTENT DETECTION
  // =========================================================================

  /**
   * GET /api/mcp/stale
   * Find pages not updated in N days (default 90)
   */
  router.get('/stale', async (req, res) => {
    try {
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
      if (!site) return res.status(404).json({ error: 'Site not found' })

      const days = Math.max(1, parseInt(req.query.days) || 90)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25))
      const cutoff = new Date(Date.now() - days * 86400000).toISOString()

      const pages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .where('updatedAt', '<', cutoff)
        .select('id', 'path', 'title', 'description', 'locale', 'updatedAt')
        .orderBy('updatedAt', 'asc')
        .limit(limit)

      const stalePages = pages.map(p => ({
        ...p,
        daysSinceUpdate: Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86400000)
      }))

      res.json({ pages: stalePages, total: stalePages.length, thresholdDays: days })
    } catch (err) {
      WIKI.logger.warn(`MCP GET /stale failed: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
