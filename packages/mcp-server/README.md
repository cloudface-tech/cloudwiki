# @cloudwiki/mcp-server

MCP Server for CloudWiki — connect Claude, Cursor, and AI agents to your wiki.

## Quick Start

```bash
npx @cloudwiki/mcp-server --url https://your-wiki.example.com
```

## Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cloudwiki": {
      "command": "npx",
      "args": ["@cloudwiki/mcp-server", "--url", "https://wiki.dev.cultbr.cultura.gov.br"]
    }
  }
}
```

## Claude Code

Add to `.claude/settings.json` or run:

```bash
claude mcp add cloudwiki -- npx @cloudwiki/mcp-server --url https://wiki.dev.cultbr.cultura.gov.br
```

## Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cloudwiki": {
      "command": "npx",
      "args": ["@cloudwiki/mcp-server", "--url", "https://wiki.dev.cultbr.cultura.gov.br"]
    }
  }
}
```

## With API Key

```bash
npx @cloudwiki/mcp-server --url https://wiki.example.com --api-key YOUR_KEY
```

Or via environment variables:

```bash
export CLOUDWIKI_URL=https://wiki.example.com
export CLOUDWIKI_API_KEY=your-key
npx @cloudwiki/mcp-server
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list-pages` | List wiki pages with filters (path, locale, tags, date) |
| `read-page` | Read a page by UUID (markdown, plain, or html) |
| `read-page-by-path` | Read a page by path (e.g. `protocolos/novo-membro`) |
| `search-pages` | Full-text search across all pages |
| `bulk-read` | Read up to 50 pages in one request |

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| `wiki-pages` | `wiki://pages` | Browse all wiki pages |

## License

AGPL-3.0
