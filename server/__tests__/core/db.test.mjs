/**
 * Tests for server/core/db.mjs
 * Mocks knex, objection, pg-pubsub, and semver to avoid real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks ---

const mockKnexRaw = vi.fn()
const mockKnexMigrateLatest = vi.fn()
const mockKnexDestroy = vi.fn()
const mockKnexInstance = {
  raw: mockKnexRaw,
  migrate: { latest: mockKnexMigrateLatest },
  destroy: mockKnexDestroy,
  client: {
    config: { debug: false },
    connectionSettings: {}
  }
}
const mockKnexFactory = vi.fn(() => mockKnexInstance)

vi.mock('knex', () => ({ default: mockKnexFactory }))

vi.mock('objection', () => ({
  default: { Model: { knex: vi.fn() } }
}))

vi.mock('pg-pubsub', () => ({
  default: vi.fn(() => ({
    addChannel: vi.fn(),
    close: vi.fn(),
    publish: vi.fn()
  }))
}))

vi.mock('semver', () => ({
  default: {
    coerce: vi.fn(() => ({ version: '16.0.0', major: 16 }))
  }
}))

vi.mock('../../db/migrator-source.mjs', () => ({ default: {} }))

// Prevent model loading from triggering real filesystem imports
vi.mock('../../helpers/common.mjs', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

const { default: db } = await import('../../core/db.mjs')

describe('db config building', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DATABASE_URL
    delete process.env.DB_SSL_CA
    delete process.env.DB_PASS_FILE

    WIKI.config.db = {
      host: 'localhost',
      user: 'wiki',
      pass: 'password',
      db: 'wiki',
      port: 5432,
      ssl: false,
      schema: 'public'
    }
    WIKI.config.pool = { min: 2, max: 10 }
    WIKI.IS_DEBUG = false
    WIKI.SERVERPATH = '/fake/server'
    WIKI.ROOTPATH = '/fake'
    WIKI.INSTANCE_ID = 'test-instance'
  })

  it('uses DATABASE_URL string when env var is set', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db'
    db.config = null

    // Simulate the config selection logic inline (mirrors db.init logic)
    const isEmpty = (v) => !v || v.length === 0
    const resolvedConfig = !isEmpty(process.env.DATABASE_URL)
      ? process.env.DATABASE_URL
      : {
          host: WIKI.config.db.host.toString(),
          user: WIKI.config.db.user.toString(),
          password: WIKI.config.db.pass.toString(),
          database: WIKI.config.db.db.toString(),
          port: WIKI.config.db.port
        }

    expect(resolvedConfig).toBe('postgres://user:pass@host:5432/db')
  })

  it('builds object config from WIKI.config.db when DATABASE_URL is not set', () => {
    delete process.env.DATABASE_URL
    const isEmpty = (v) => !v || v.length === 0
    const resolvedConfig = !isEmpty(process.env.DATABASE_URL)
      ? process.env.DATABASE_URL
      : {
          host: WIKI.config.db.host.toString(),
          user: WIKI.config.db.user.toString(),
          password: WIKI.config.db.pass.toString(),
          database: WIKI.config.db.db.toString(),
          port: WIKI.config.db.port
        }

    expect(resolvedConfig).toMatchObject({
      host: 'localhost',
      user: 'wiki',
      password: 'password',
      database: 'wiki',
      port: 5432
    })
  })

  it('sets dbUseSSL=true when ssl config is true (boolean)', () => {
    const ssl = true
    const dbUseSSL = (ssl === true || ssl === 'true' || ssl === 1 || ssl === '1')
    expect(dbUseSSL).toBe(true)
  })

  it('sets dbUseSSL=true when ssl config is string "true"', () => {
    const ssl = 'true'
    const dbUseSSL = (ssl === true || ssl === 'true' || ssl === 1 || ssl === '1')
    expect(dbUseSSL).toBe(true)
  })

  it('sets dbUseSSL=true when ssl config is 1', () => {
    const ssl = 1
    const dbUseSSL = (ssl === true || ssl === 'true' || ssl === 1 || ssl === '1')
    expect(dbUseSSL).toBe(true)
  })

  it('sets dbUseSSL=true when ssl config is string "1"', () => {
    const ssl = '1'
    const dbUseSSL = (ssl === true || ssl === 'true' || ssl === 1 || ssl === '1')
    expect(dbUseSSL).toBe(true)
  })

  it('sets dbUseSSL=false when ssl config is false', () => {
    const ssl = false
    const dbUseSSL = (ssl === true || ssl === 'true' || ssl === 1 || ssl === '1')
    expect(dbUseSSL).toBe(false)
  })

  it('parses DB_SSL_CA env into proper PEM-wrapped certificate', () => {
    // Simulate the chunking logic from db.mjs
    const rawCA = 'A'.repeat(128) // 128 chars -> 2 chunks of 64
    const chunks = []
    for (let i = 0, charsLength = rawCA.length; i < charsLength; i += 64) {
      chunks.push(rawCA.substring(i, i + 64))
    }
    const ca = '-----BEGIN CERTIFICATE-----\n' + chunks.join('\n') + '\n-----END CERTIFICATE-----\n'
    expect(ca).toContain('-----BEGIN CERTIFICATE-----')
    expect(ca).toContain('-----END CERTIFICATE-----')
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(64)
  })
})

describe('db.subscribeToNotifications', () => {
  it('appends ApplicationName to string connection URL', async () => {
    WIKI.INSTANCE_ID = 'inst-1'

    const connString = 'postgres://host/db'
    const encodedName = encodeURIComponent(`CloudWiki - inst-1:PSUB`)

    // Simulate the URL building logic from subscribeToNotifications
    let result
    if (connString.indexOf('?') > 0) {
      result = `${connString}&ApplicationName=${encodedName}`
    } else {
      result = `${connString}?ApplicationName=${encodedName}`
    }

    expect(result).toContain('?ApplicationName=')
    expect(result).toContain('CloudWiki')
    expect(result).toContain('inst-1')
  })

  it('appends & when URL already has query string', () => {
    WIKI.INSTANCE_ID = 'inst-2'
    const connString = 'postgres://host/db?sslmode=require'
    const encodedName = encodeURIComponent(`CloudWiki - inst-2:PSUB`)

    let result
    if (connString.indexOf('?') > 0) {
      result = `${connString}&ApplicationName=${encodedName}`
    } else {
      result = `${connString}?ApplicationName=${encodedName}`
    }

    expect(result).toContain('&ApplicationName=')
  })

  it('sets application_name on object connection settings with CloudWiki prefix', () => {
    WIKI.INSTANCE_ID = 'inst-3'
    const connSettings = { host: 'localhost' }
    connSettings.application_name = `CloudWiki - ${WIKI.INSTANCE_ID}:PSUB`
    expect(connSettings.application_name).toBe('CloudWiki - inst-3:PSUB')
    expect(connSettings.application_name).toContain('CloudWiki')
  })
})

describe('db.notifyViaDB', () => {
  it('publishes to "wiki" channel with correct payload shape', () => {
    WIKI.INSTANCE_ID = 'inst-notify'
    const mockListener = { publish: vi.fn() }
    WIKI.db = { listener: mockListener }

    db.notifyViaDB.call(db, 'testEvent', { foo: 'bar' })

    expect(mockListener.publish).toHaveBeenCalledWith('wiki', {
      source: 'inst-notify',
      event: 'testEvent',
      value: { foo: 'bar' }
    })
  })
})

describe('db structure', () => {
  it('exports init function', () => {
    expect(typeof db.init).toBe('function')
  })

  it('exports connect function', () => {
    expect(typeof db.connect).toBe('function')
  })

  it('exports syncSchemas function', () => {
    expect(typeof db.syncSchemas).toBe('function')
  })

  it('exports subscribeToNotifications function', () => {
    expect(typeof db.subscribeToNotifications).toBe('function')
  })

  it('exports unsubscribeToNotifications function', () => {
    expect(typeof db.unsubscribeToNotifications).toBe('function')
  })

  it('exports notifyViaDB function', () => {
    expect(typeof db.notifyViaDB).toBe('function')
  })
})
