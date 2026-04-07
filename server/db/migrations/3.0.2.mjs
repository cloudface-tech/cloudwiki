/**
 * CloudWiki 3.0.2 Migration
 * Add pgvector support for semantic search
 *
 * pgvector must be enabled by a DB admin beforehand:
 *   CREATE EXTENSION IF NOT EXISTS vector;
 * On AWS RDS/Aurora this requires rds_superuser role.
 * If pgvector is not installed, this migration is a no-op.
 */

export async function up (knex) {
  // Check if pgvector extension is already installed (read-only, safe in transaction)
  const result = await knex.raw("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
  const hasVector = result.rows?.length > 0

  if (!hasVector) {
    console.info('[3.0.2] pgvector extension not installed — skipping embedding column. To enable semantic search, a DB admin must run: CREATE EXTENSION vector;')
    return
  }

  console.info('[3.0.2] pgvector extension found')

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
