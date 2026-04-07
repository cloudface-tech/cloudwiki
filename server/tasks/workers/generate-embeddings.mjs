import { generateEmbedding, stripHtml } from '../../modules/search/embeddings.mjs'

export async function generatePageEmbedding (pageId) {
  const model = WIKI.config.search?.embeddingModel || 'multilingual-e5-small'
  const apiKey = WIKI.config.search?.openaiApiKey || ''

  const page = await WIKI.db.knex('pages')
    .where('id', pageId)
    .select('id', 'title', 'description', 'searchContent')
    .first()

  if (!page) {
    WIKI.logger.warn(`[Embeddings] Page ${pageId} not found`)
    return
  }

  const text = [page.title, page.description, stripHtml(page.searchContent || '')]
    .filter(Boolean)
    .join(' ')
    .slice(0, 8192)

  if (text.length < 10) {
    WIKI.logger.debug(`[Embeddings] Skipping page ${pageId} — too short`)
    return
  }

  try {
    const embedding = await generateEmbedding(text, model, apiKey)
    const embeddingStr = `[${embedding.join(',')}]`

    await WIKI.db.knex('pages')
      .where('id', pageId)
      .update({
        embedding: WIKI.db.knex.raw('?::vector', [embeddingStr]),
        embeddingModel: model
      })

    WIKI.logger.debug(`[Embeddings] Generated embedding for page ${pageId} (${model})`)
  } catch (err) {
    WIKI.logger.warn(`[Embeddings] Failed for page ${pageId}: ${err.message}`)
  }
}

export async function reindexAllPages () {
  const pages = await WIKI.db.knex('pages')
    .select('id')
    .where('publishState', 'published')

  WIKI.logger.info(`[Embeddings] Re-indexing ${pages.length} pages...`)

  for (const page of pages) {
    await generatePageEmbedding(page.id)
  }

  WIKI.logger.info(`[Embeddings] Re-indexing complete`)
}
