import { createHash } from 'node:crypto'
import { marked } from 'marked'
import { v4 as uuidv4 } from 'uuid'

export function generatePageHash (path, locale) {
  return createHash('sha256').update(`${locale}:${path}`).digest('hex')
}

export function markdownToHtml (md) {
  if (!md) return ''
  return marked.parse(md, { async: false })
}

export function stripHtml (html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

export function getDefaultAuthorId () {
  return WIKI.config?.api?.mcpDefaultAuthorId || '3431b098-9a8a-4e25-8ffb-2c95d5f60df4'
}

export function buildPageDefaults (siteId) {
  return {
    config: {},
    relations: [],
    scripts: {},
    historyData: {},
    isBrowsable: true,
    isSearchable: true,
    ratingScore: 0,
    ratingCount: 0,
    authorId: getDefaultAuthorId(),
    creatorId: getDefaultAuthorId(),
    ownerId: getDefaultAuthorId(),
    siteId
  }
}

export { uuidv4 }
