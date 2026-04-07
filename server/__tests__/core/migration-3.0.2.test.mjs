import { describe, it, expect, vi, beforeEach } from 'vitest'
import { up } from '../../db/migrations/3.0.2.mjs'

describe('Migration 3.0.2 — pgvector semantic search', () => {
  let knex

  function makeKnex ({ hasExtension = false, hasColumn = false } = {}) {
    return {
      raw: vi.fn().mockResolvedValue({ rows: hasExtension ? [{ '?column?': 1 }] : [] }),
      schema: {
        hasColumn: vi.fn().mockResolvedValue(hasColumn),
        alterTable: vi.fn().mockResolvedValue(undefined)
      }
    }
  }

  it('should skip when pgvector extension is not installed', async () => {
    knex = makeKnex({ hasExtension: false })
    await up(knex)
    expect(knex.raw).toHaveBeenCalledWith("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
    expect(knex.schema.hasColumn).not.toHaveBeenCalled()
    expect(knex.schema.alterTable).not.toHaveBeenCalled()
  })

  it('should add embedding column when pgvector exists and column missing', async () => {
    knex = makeKnex({ hasExtension: true, hasColumn: false })
    await up(knex)
    expect(knex.schema.hasColumn).toHaveBeenCalledWith('pages', 'embedding')
    expect(knex.schema.alterTable).toHaveBeenCalled()
  })

  it('should skip alter when embedding column already exists', async () => {
    knex = makeKnex({ hasExtension: true, hasColumn: true })
    await up(knex)
    expect(knex.schema.hasColumn).toHaveBeenCalledWith('pages', 'embedding')
    expect(knex.schema.alterTable).not.toHaveBeenCalled()
  })
})
