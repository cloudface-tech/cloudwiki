import { describe, it, expect, vi, beforeEach } from 'vitest'
import { up } from '../../db/migrations/3.0.2.mjs'

describe('Migration 3.0.2 — pgvector semantic search', () => {
  let knex

  beforeEach(() => {
    knex = {
      raw: vi.fn().mockResolvedValue(undefined),
      schema: {
        hasColumn: vi.fn().mockResolvedValue(false),
        alterTable: vi.fn().mockResolvedValue(undefined)
      }
    }
  })

  it('should create vector extension', async () => {
    await up(knex)
    expect(knex.raw).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector')
  })

  it('should add embedding column when not exists', async () => {
    knex.schema.hasColumn.mockResolvedValue(false)
    await up(knex)
    expect(knex.schema.hasColumn).toHaveBeenCalledWith('pages', 'embedding')
    expect(knex.schema.alterTable).toHaveBeenCalled()
  })

  it('should skip embedding column when already exists', async () => {
    knex.schema.hasColumn.mockResolvedValue(true)
    await up(knex)
    expect(knex.schema.alterTable).not.toHaveBeenCalled()
  })
})
