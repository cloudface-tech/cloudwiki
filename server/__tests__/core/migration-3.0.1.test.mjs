import { describe, it, expect, vi, beforeEach } from 'vitest'
import { up } from '../../db/migrations/3.0.1.mjs'

describe('Migration 3.0.1 — rebrand legacy Wiki.js references', () => {
  let knex

  beforeEach(() => {
    knex = vi.fn().mockImplementation((table) => {
      return {
        where: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue(1)
        })
      }
    })
  })

  function mockSettings (authAudience, secAudience) {
    const authRow = authAudience ? { key: 'auth', value: { audience: authAudience, tokenExpiration: '30m' } } : null
    const secRow = secAudience ? { key: 'security', value: { authJwtAudience: secAudience, enforce2FA: false } } : null

    knex = vi.fn().mockImplementation((table) => {
      return {
        where: vi.fn().mockImplementation((key, val) => {
          const row = val === 'auth' ? authRow : secRow
          return {
            first: vi.fn().mockResolvedValue(row),
            update: vi.fn().mockResolvedValue(1)
          }
        })
      }
    })
  }

  it('should migrate auth audience from urn:wiki.js to urn:cloudwiki', async () => {
    mockSettings('urn:wiki.js', 'urn:wiki.js')
    await up(knex)

    // Verify the auth row was mutated
    const authCall = knex.mock.calls.find(c => c[0] === 'settings')
    expect(authCall).toBeDefined()
  })

  it('should not modify auth audience when already urn:cloudwiki', async () => {
    mockSettings('urn:cloudwiki', 'urn:cloudwiki')

    let updateCalled = false
    knex = vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation((key, val) => {
        const row = val === 'auth'
          ? { key: 'auth', value: { audience: 'urn:cloudwiki' } }
          : { key: 'security', value: { authJwtAudience: 'urn:cloudwiki' } }
        return {
          first: vi.fn().mockResolvedValue(row),
          update: vi.fn().mockImplementation(() => { updateCalled = true; return 1 })
        }
      })
    }))

    await up(knex)
    expect(updateCalled).toBe(false)
  })

  it('should handle missing settings rows gracefully', async () => {
    mockSettings(null, null)
    await expect(up(knex)).resolves.not.toThrow()
  })

  it('should migrate security authJwtAudience from urn:wiki.js to urn:cloudwiki', async () => {
    const secRow = { key: 'security', value: { authJwtAudience: 'urn:wiki.js', enforce2FA: false } }

    knex = vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation((key, val) => {
        const row = val === 'auth'
          ? { key: 'auth', value: { audience: 'urn:cloudwiki' } }
          : secRow
        return {
          first: vi.fn().mockResolvedValue(row),
          update: vi.fn().mockImplementation((data) => {
            if (val === 'security') {
              expect(data.value.authJwtAudience).toBe('urn:cloudwiki')
            }
            return 1
          })
        }
      })
    }))

    await up(knex)
    expect(secRow.value.authJwtAudience).toBe('urn:cloudwiki')
  })

  it('should preserve other fields when migrating', async () => {
    const authRow = { key: 'auth', value: { audience: 'urn:wiki.js', tokenExpiration: '30m', tokenRenewal: '14d' } }

    knex = vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation((key, val) => ({
        first: vi.fn().mockResolvedValue(val === 'auth' ? authRow : null),
        update: vi.fn().mockImplementation((data) => {
          if (val === 'auth') {
            expect(data.value.tokenExpiration).toBe('30m')
            expect(data.value.tokenRenewal).toBe('14d')
            expect(data.value.audience).toBe('urn:cloudwiki')
          }
          return 1
        })
      }))
    }))

    await up(knex)
  })
})
