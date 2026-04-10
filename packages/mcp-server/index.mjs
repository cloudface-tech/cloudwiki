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

// -----------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------

const transport = new StdioServerTransport()
await server.connect(transport)
