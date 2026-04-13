#!/usr/bin/env node

/**
 * CloudWiki MCP Server
 *
 * Connects Claude Desktop, Claude Code, Cursor, and other MCP-compatible
 * AI tools to a CloudWiki instance via the MCP API v2.
 *
 * Usage:
 *   npx @cloudwiki/mcp-server --url https://wiki.dev.cultbr.cultura.gov.br
 *   npx @cloudwiki/mcp-server --url https://wiki.example.com --api-key YOUR_KEY
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "cloudwiki": {
 *         "command": "npx",
 *         "args": ["@cloudwiki/mcp-server", "--url", "https://wiki.dev.cultbr.cultura.gov.br"]
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// Parse CLI args
const args = process.argv.slice(2)
let baseUrl = ''
let apiKey = ''

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--url' || args[i] === '-u') && args[i + 1]) {
    baseUrl = args[++i].replace(/\/+$/, '')
  } else if ((args[i] === '--api-key' || args[i] === '-k') && args[i + 1]) {
    apiKey = args[++i]
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.error(`
CloudWiki MCP Server

Usage:
  npx @cloudwiki/mcp-server --url <WIKI_URL> [--api-key <KEY>]

Options:
  --url, -u       CloudWiki base URL (required)
  --api-key, -k   API key for authentication (optional)
  --help, -h      Show this help

Environment Variables:
  CLOUDWIKI_URL       Alternative to --url
  CLOUDWIKI_API_KEY   Alternative to --api-key

Examples:
  npx @cloudwiki/mcp-server --url https://wiki.dev.cultbr.cultura.gov.br
  CLOUDWIKI_URL=https://wiki.example.com npx @cloudwiki/mcp-server
`)
    process.exit(0)
  }
}

baseUrl = baseUrl || process.env.CLOUDWIKI_URL || ''
apiKey = apiKey || process.env.CLOUDWIKI_API_KEY || ''

if (!baseUrl) {
  console.error('Error: --url or CLOUDWIKI_URL is required. Run with --help for usage.')
  process.exit(1)
}

const API_BASE = `${baseUrl}/api/mcp`

// -----------------------------------------------------------------------
// HTTP helpers
// -----------------------------------------------------------------------

async function apiFetch (path, options = {}) {
  const url = `${API_BASE}${path}`
  const headers = { 'Accept': 'application/json', ...options.headers }
  if (apiKey) headers['X-API-Key'] = apiKey
  if (options.body) headers['Content-Type'] = 'application/json'

  const resp = await fetch(url, { ...options, headers })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`API error ${resp.status}: ${text}`)
  }
  return resp.json()
}

// -----------------------------------------------------------------------
// MCP Server
// -----------------------------------------------------------------------

const server = new McpServer({
  name: 'cloudwiki',
  version: '1.0.0'
})

// -- Resources: wiki pages as browsable resources --

server.resource(
  'wiki-pages',
  'wiki://pages',
  async (uri) => {
    const data = await apiFetch('/pages?limit=100')
    const listing = data.pages.map(p => `- ${p.title} (${p.path}) [${p.locale}]`).join('\n')
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'text/plain',
        text: `CloudWiki Pages (${data.pagination.total} total):\n\n${listing}`
      }]
    }
  }
)

// -- Tools --

server.tool(
  'list-pages',
  'List wiki pages with optional filters',
  {
    page: z.number().optional().describe('Page number (default: 1)'),
    limit: z.number().optional().describe('Results per page (default: 25, max: 100)'),
    path: z.string().optional().describe('Filter by path prefix (e.g. nees/transversal)'),
    locale: z.string().optional().describe('Filter by locale (e.g. pt, en)'),
    tags: z.string().optional().describe('Filter by tags (comma-separated)'),
    updatedAfter: z.string().optional().describe('Only pages updated after this ISO date')
  },
  async (params) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', params.page)
    if (params.limit) qs.set('limit', params.limit)
    if (params.path) qs.set('path', params.path)
    if (params.locale) qs.set('locale', params.locale)
    if (params.tags) qs.set('tags', params.tags)
    if (params.updatedAfter) qs.set('updatedAfter', params.updatedAfter)

    const data = await apiFetch(`/pages?${qs}`)
    const text = data.pages.map(p =>
      `**${p.title}**\n  Path: ${p.path} | ID: ${p.id}\n  ${p.description || '(no description)'}\n  Updated: ${p.updatedAt}`
    ).join('\n\n')

    return {
      content: [{
        type: 'text',
        text: `Found ${data.pagination.total} pages (showing ${data.pages.length}):\n\n${text}`
      }]
    }
  }
)

server.tool(
  'read-page',
  'Read the full content of a wiki page by ID',
  {
    id: z.string().describe('Page UUID'),
    format: z.enum(['markdown', 'plain', 'html']).optional().describe('Content format (default: markdown)')
  },
  async (params) => {
    const format = params.format || 'markdown'
    const data = await apiFetch(`/pages/${params.id}?format=${format}`)
    return {
      content: [{
        type: 'text',
        text: `# ${data.title}\n\n${data.description ? `> ${data.description}\n\n` : ''}${data.content}`
      }]
    }
  }
)

server.tool(
  'read-page-by-path',
  'Read the full content of a wiki page by its path',
  {
    path: z.string().describe('Page path (e.g. organograma, protocolos/novo-membro)'),
    format: z.enum(['markdown', 'plain', 'html']).optional().describe('Content format (default: markdown)')
  },
  async (params) => {
    const format = params.format || 'markdown'
    const data = await apiFetch(`/page-by-path?path=${encodeURIComponent(params.path)}&format=${format}`)
    return {
      content: [{
        type: 'text',
        text: `# ${data.title}\n\n${data.description ? `> ${data.description}\n\n` : ''}${data.content}`
      }]
    }
  }
)

server.tool(
  'search-pages',
  'Search wiki pages by keyword',
  {
    query: z.string().describe('Search query'),
    page: z.number().optional().describe('Page number (default: 1)'),
    limit: z.number().optional().describe('Results per page (default: 25)'),
    path: z.string().optional().describe('Filter by path prefix'),
    locale: z.string().optional().describe('Filter by locale')
  },
  async (params) => {
    const qs = new URLSearchParams({ q: params.query })
    if (params.page) qs.set('page', params.page)
    if (params.limit) qs.set('limit', params.limit)
    if (params.path) qs.set('path', params.path)
    if (params.locale) qs.set('locale', params.locale)

    const data = await apiFetch(`/search?${qs}`)
    const text = data.pages.map(p =>
      `**${p.title}** — /${p.path}\n  ${p.description || ''}`
    ).join('\n\n')

    return {
      content: [{
        type: 'text',
        text: `Search "${params.query}" — ${data.pagination.total} results:\n\n${text || '(no results)'}`
      }]
    }
  }
)

server.tool(
  'bulk-read',
  'Read multiple wiki pages at once (max 50)',
  {
    ids: z.array(z.string()).describe('Array of page UUIDs'),
    format: z.enum(['markdown', 'plain', 'html']).optional().describe('Content format (default: markdown)')
  },
  async (params) => {
    const data = await apiFetch('/pages/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: params.ids, format: params.format || 'markdown' })
    })
    const text = data.pages.map(p =>
      `---\n# ${p.title}\nPath: ${p.path}\n\n${p.content}`
    ).join('\n\n')

    return {
      content: [{
        type: 'text',
        text: `Bulk read: ${data.found}/${data.requested} pages found\n\n${text}`
      }]
    }
  }
)

// -- Write Tools --

server.tool(
  'create-page',
  'Create a new wiki page',
  {
    title: z.string().describe('Page title (required)'),
    path: z.string().describe('Page path/slug (required, e.g. docs/getting-started)'),
    content: z.string().optional().describe('Page content'),
    format: z.enum(['markdown', 'html']).optional().describe('Content format (default: html)'),
    description: z.string().optional().describe('Page description/summary'),
    locale: z.string().optional().describe('Locale (default: en)'),
    tags: z.array(z.string()).optional().describe('Tags array'),
    icon: z.string().optional().describe('Icon class (e.g. las la-home)')
  },
  async (params) => {
    const body = {
      title: params.title,
      path: params.path,
      content: params.content || '',
      format: params.format || 'html',
      description: params.description || '',
      locale: params.locale || 'en',
      tags: params.tags || [],
      icon: params.icon || ''
    }
    const data = await apiFetch('/pages', {
      method: 'POST',
      body: JSON.stringify(body)
    })
    return {
      content: [{
        type: 'text',
        text: `Page created: "${data.title}" at /${data.path} (ID: ${data.id})`
      }]
    }
  }
)

server.tool(
  'update-page',
  'Update an existing wiki page',
  {
    id: z.string().describe('Page UUID (required)'),
    title: z.string().optional().describe('New title'),
    path: z.string().optional().describe('New path'),
    content: z.string().optional().describe('New content'),
    format: z.enum(['markdown', 'html']).optional().describe('Content format'),
    description: z.string().optional().describe('New description'),
    locale: z.string().optional().describe('New locale'),
    tags: z.array(z.string()).optional().describe('New tags'),
    icon: z.string().optional().describe('New icon'),
    publishState: z.enum(['published', 'draft']).optional().describe('Publish state')
  },
  async (params) => {
    const { id, ...body } = params
    const data = await apiFetch(`/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
    return {
      content: [{
        type: 'text',
        text: `Page updated: "${data.title}" at /${data.path} (ID: ${data.id})`
      }]
    }
  }
)

server.tool(
  'delete-page',
  'Delete a wiki page permanently',
  {
    id: z.string().describe('Page UUID to delete')
  },
  async (params) => {
    const data = await apiFetch(`/pages/${params.id}`, { method: 'DELETE' })
    return {
      content: [{
        type: 'text',
        text: `Page deleted: /${data.path} (ID: ${data.id})`
      }]
    }
  }
)

server.tool(
  'list-templates',
  'List available page templates',
  {},
  async () => {
    const data = await apiFetch('/templates')
    const text = data.templates.map(t =>
      `**${t.title}** — ID: ${t.id}\n  Path: ${t.path} | ${t.description || '(no description)'}`
    ).join('\n\n')
    return {
      content: [{
        type: 'text',
        text: `${data.total} templates found:\n\n${text || '(no templates)'}`
      }]
    }
  }
)

server.tool(
  'create-from-template',
  'Create a new page from an existing template',
  {
    templateId: z.string().describe('Template page UUID'),
    title: z.string().describe('New page title'),
    path: z.string().describe('New page path'),
    locale: z.string().optional().describe('Locale (default: en)'),
    tags: z.array(z.string()).optional().describe('Tags for new page'),
    description: z.string().optional().describe('Page description')
  },
  async (params) => {
    const body = {
      title: params.title,
      path: params.path,
      locale: params.locale,
      tags: params.tags,
      description: params.description
    }
    const data = await apiFetch(`/templates/${params.templateId}/create`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    return {
      content: [{
        type: 'text',
        text: `Page created from template: "${data.title}" at /${data.path} (ID: ${data.id})`
      }]
    }
  }
)

// -- Comments Tools --

server.tool(
  'list-comments',
  'List comments on a wiki page (threaded)',
  {
    pageId: z.string().describe('Page UUID')
  },
  async (params) => {
    const data = await apiFetch(`/pages/${params.pageId}/comments`)
    const text = data.comments.map(c => {
      let line = `**${c.authorName}** (${c.createdAt}):\n  ${c.content}`
      if (c.replies?.length) {
        line += '\n' + c.replies.map(r =>
          `  ↳ **${r.authorName}**: ${r.content}`
        ).join('\n')
      }
      return line
    }).join('\n\n')
    return {
      content: [{
        type: 'text',
        text: `${data.total} comments:\n\n${text || '(no comments)'}`
      }]
    }
  }
)

server.tool(
  'add-comment',
  'Add a comment to a wiki page',
  {
    pageId: z.string().describe('Page UUID'),
    authorName: z.string().describe('Author name'),
    content: z.string().describe('Comment text'),
    authorEmail: z.string().optional().describe('Author email'),
    parentId: z.string().optional().describe('Parent comment UUID for reply'),
    mentions: z.array(z.string()).optional().describe('Mentioned usernames')
  },
  async (params) => {
    const { pageId, ...body } = params
    const data = await apiFetch(`/pages/${pageId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    return {
      content: [{
        type: 'text',
        text: `Comment added by ${data.authorName} (ID: ${data.id})${data.parentId ? ' [reply]' : ''}`
      }]
    }
  }
)

server.tool(
  'delete-comment',
  'Delete a comment and its replies',
  {
    id: z.string().describe('Comment UUID')
  },
  async (params) => {
    const data = await apiFetch(`/comments/${params.id}`, { method: 'DELETE' })
    return {
      content: [{
        type: 'text',
        text: `Comment deleted (ID: ${data.id})`
      }]
    }
  }
)

// -- Permissions Tools --

server.tool(
  'list-permissions',
  'List permissions for a wiki page',
  {
    pageId: z.string().describe('Page UUID')
  },
  async (params) => {
    const data = await apiFetch(`/pages/${params.pageId}/permissions`)
    const text = data.permissions.map(p =>
      `${p.subjectType}:${p.subjectId} → ${p.level} (ID: ${p.id})`
    ).join('\n')
    return {
      content: [{
        type: 'text',
        text: `${data.total} permissions:\n\n${text || '(no custom permissions)'}`
      }]
    }
  }
)

server.tool(
  'set-permission',
  'Set a permission on a wiki page (creates or updates)',
  {
    pageId: z.string().describe('Page UUID'),
    subjectType: z.enum(['user', 'group']).describe('Subject type'),
    subjectId: z.string().describe('User or group ID'),
    level: z.enum(['read', 'write', 'admin']).describe('Permission level')
  },
  async (params) => {
    const { pageId, ...body } = params
    const data = await apiFetch(`/pages/${pageId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    const action = data.updated ? 'updated' : 'created'
    return {
      content: [{
        type: 'text',
        text: `Permission ${action}: ${data.subjectType}:${data.subjectId} → ${data.level}`
      }]
    }
  }
)

server.tool(
  'remove-permission',
  'Remove a permission from a page',
  {
    id: z.string().describe('Permission UUID')
  },
  async (params) => {
    const data = await apiFetch(`/permissions/${params.id}`, { method: 'DELETE' })
    return {
      content: [{
        type: 'text',
        text: `Permission removed (ID: ${data.id})`
      }]
    }
  }
)

// -- AI Tools --

server.tool(
  'ask',
  'Ask a question about wiki content — returns relevant pages ranked by relevance',
  {
    question: z.string().describe('Question to ask about wiki content'),
    limit: z.number().optional().describe('Max results (default: 5, max: 10)'),
    locale: z.string().optional().describe('Filter by locale'),
    path: z.string().optional().describe('Filter by path prefix')
  },
  async (params) => {
    const data = await apiFetch('/ask', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    const text = data.results.map(r =>
      `**${r.title}** (score: ${r.score})\n  /${r.path}\n  ${r.excerpt}`
    ).join('\n\n')
    return {
      content: [{
        type: 'text',
        text: `Q: "${data.question}" — ${data.total} results (${data.method} search):\n\n${text || '(no results)'}`
      }]
    }
  }
)

server.tool(
  'translate-page',
  'Create a translated copy of a page in another locale (created as draft)',
  {
    pageId: z.string().describe('Source page UUID'),
    targetLocale: z.string().describe('Target locale (e.g. en, pt, es)'),
    targetPath: z.string().optional().describe('Custom path for translated page')
  },
  async (params) => {
    const data = await apiFetch('/translate', {
      method: 'POST',
      body: JSON.stringify(params)
    })
    return {
      content: [{
        type: 'text',
        text: `Translated page created: "${data.title}" at /${data.path} (${data.locale})\nSource: /${data.sourcePath}\nStatus: ${data.publishState}\n${data.note}`
      }]
    }
  }
)

// -----------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------

const transport = new StdioServerTransport()
await server.connect(transport)
