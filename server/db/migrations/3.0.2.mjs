/**
 * CloudWiki 3.0.2 Migration
 * Add pgvector support for semantic search
 */

export async function up (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector')
  console.info('[3.0.2] pgvector extension enabled')

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
