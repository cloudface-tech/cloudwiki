/**
 * CloudWiki 3.0.2 Migration
 * Add pgvector support for semantic search
 */

export async function up (knex) {
  // Check if pgvector is available (may not be on managed DB without superuser)
  let hasVector = false
  try {
    const result = await knex.raw("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
    hasVector = result.rows?.length > 0
  } catch { /* ignore */ }

  if (!hasVector) {
    try {
      await knex.raw('CREATE EXTENSION IF NOT EXISTS vector')
      hasVector = true
      console.info('[3.0.2] pgvector extension enabled')
    } catch (err) {
      console.warn(`[3.0.2] pgvector not available (${err.code}). Semantic search disabled until a DB admin runs: CREATE EXTENSION vector;`)
    }
  }

  if (!hasVector) return

  const hasEmbedding = await knex.schema.hasColumn('pages', 'embedding')
  if (!hasEmbedding) {
    await knex.schema.alterTable('pages', table => {
      table.specificType('embedding', 'vector(384)')
      table.string('embeddingModel', 100)
    })
    console.info('[3.0.2] Added embedding column to pages table')
  }
}

export function down (knex) {}
