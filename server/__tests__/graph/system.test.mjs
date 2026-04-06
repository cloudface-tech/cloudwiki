import { describe, it, expect, vi, beforeEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'

// Resolver imports happen after WIKI is set up by setup.mjs.
// We import the resolver here and call its field functions directly.
import resolvers from '../../graph/resolvers/system.mjs'

const { Query, Mutation, SystemInfo } = resolvers

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext (overrides = {}) {
  return {
    req: {
      user: { id: 1 },
      ...overrides.req
    },
    ...overrides
  }
}

function makeKnexChain (returnValue) {
  // Returns a chainable knex mock that resolves to returnValue.
  const chain = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    andWhereLike: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(returnValue),
    del: vi.fn().mockResolvedValue(returnValue),
    insert: vi.fn().mockResolvedValue(returnValue),
    then: undefined // not a promise itself — callers await first()
  }
  // Make the chain itself awaitable (for queries that don't call .first())
  chain[Symbol.iterator] = undefined
  return new Proxy(chain, {
    get (target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'then') return undefined
      return target[prop] ?? vi.fn().mockReturnThis()
    }
  })
}

// ---------------------------------------------------------------------------
// Query: metricsState
// ---------------------------------------------------------------------------

describe('Query.metricsState', () => {
  it('returns false when metrics not configured', () => {
    WIKI.config.metrics = undefined
    expect(Query.metricsState()).toBe(false)
  })

  it('returns true when metrics.isEnabled is true', () => {
    WIKI.config.metrics = { isEnabled: true }
    expect(Query.metricsState()).toBe(true)
  })

  it('returns false when metrics.isEnabled is false', () => {
    WIKI.config.metrics = { isEnabled: false }
    expect(Query.metricsState()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Query: systemFlags
// ---------------------------------------------------------------------------

describe('Query.systemFlags', () => {
  it('returns WIKI.config.flags', () => {
    WIKI.config.flags = { ldapdebug: true, experimental: false }
    expect(Query.systemFlags()).toEqual({ ldapdebug: true, experimental: false })
  })
})

// ---------------------------------------------------------------------------
// Query: systemInfo — access control
// ---------------------------------------------------------------------------

describe('Query.systemInfo', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.systemInfo({}, {}, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns empty object when access granted', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const result = await Query.systemInfo({}, {}, makeContext())
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Query: systemSecurity — access control
// ---------------------------------------------------------------------------

describe('Query.systemSecurity', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    expect(() => Query.systemSecurity({}, {}, makeContext())).toThrow('ERR_FORBIDDEN')
  })

  it('returns WIKI.config.security when access granted', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.config.security = { cors: { enabled: true } }
    const result = Query.systemSecurity({}, {}, makeContext())
    expect(result).toEqual({ cors: { enabled: true } })
  })
})

// ---------------------------------------------------------------------------
// Query: systemSearch — dictOverrides serialization
// ---------------------------------------------------------------------------

describe('Query.systemSearch', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    expect(() => Query.systemSearch({}, {}, makeContext())).toThrow('ERR_FORBIDDEN')
  })

  it('serializes dictOverrides to JSON string', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.config.search = {
      termHighlighting: true,
      dictOverrides: { en: 'english', pt: 'portuguese' }
    }
    const result = Query.systemSearch({}, {}, makeContext())
    expect(result.termHighlighting).toBe(true)
    expect(typeof result.dictOverrides).toBe('string')
    expect(JSON.parse(result.dictOverrides)).toEqual({ en: 'english', pt: 'portuguese' })
  })
})

// ---------------------------------------------------------------------------
// Query: systemJobs — state filtering
// ---------------------------------------------------------------------------

describe('Query.systemJobs', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
  })

  it('uppercases the state field on each result', async () => {
    const rows = [
      { id: 1, task: 'rebuildSearchIndex', state: 'completed', startedAt: new Date() },
      { id: 2, task: 'checkVersion', state: 'failed', startedAt: new Date() }
    ]
    const chain = makeKnexChain(null)
    // orderBy returns a promise that resolves to rows
    chain.orderBy = vi.fn().mockResolvedValue(rows)
    chain.whereIn = vi.fn().mockReturnValue(chain)
    WIKI.db.knex = vi.fn().mockReturnValue(chain)

    const result = await Query.systemJobs({}, { states: [] }, makeContext())
    expect(result[0].state).toBe('COMPLETED')
    expect(result[1].state).toBe('FAILED')
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.systemJobs({}, {}, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })
})

// ---------------------------------------------------------------------------
// Mutation: cancelJob
// ---------------------------------------------------------------------------

describe('Mutation.cancelJob', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('returns ERR_FORBIDDEN error object when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.cancelJob({}, { id: 'abc' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('returns success when job deleted (del returns 1)', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const chain = makeKnexChain(null)
    chain.where = vi.fn().mockReturnValue(chain)
    chain.del = vi.fn().mockResolvedValue(1)
    WIKI.db.knex = vi.fn().mockReturnValue(chain)

    const result = await Mutation.cancelJob({}, { id: 'abc' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
  })

  it('returns error when job not found (del returns 0)', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const chain = makeKnexChain(null)
    chain.where = vi.fn().mockReturnValue(chain)
    chain.del = vi.fn().mockResolvedValue(0)
    WIKI.db.knex = vi.fn().mockReturnValue(chain)

    const result = await Mutation.cancelJob({}, { id: 'abc' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mutation: retryJob
// ---------------------------------------------------------------------------

describe('Mutation.retryJob', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
    WIKI.INSTANCE_ID = 'test-instance'
  })

  it('returns error when job not found', async () => {
    const historyChain = makeKnexChain(null) // first() returns null
    const jobsChain = makeKnexChain(null)
    WIKI.db.knex = vi.fn((table) => table === 'jobHistory' ? historyChain : jobsChain)

    const result = await Mutation.retryJob({}, { id: 'nonexistent' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/No such job found/)
  })

  it('returns error for interrupted jobs', async () => {
    const job = { id: 'j1', state: 'interrupted', attempt: 1, maxRetries: 3 }
    const historyChain = makeKnexChain(job)
    WIKI.db.knex = vi.fn().mockReturnValue(historyChain)

    const result = await Mutation.retryJob({}, { id: 'j1' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/interrupted/)
  })

  it('returns error for failed job below maxRetries', async () => {
    const job = { id: 'j2', state: 'failed', attempt: 1, maxRetries: 5 }
    const historyChain = makeKnexChain(job)
    WIKI.db.knex = vi.fn().mockReturnValue(historyChain)

    const result = await Mutation.retryJob({}, { id: 'j2' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/maximum retry/)
  })

  it('reschedules a failed job that reached maxRetries', async () => {
    const job = {
      id: 'j3', task: 'checkVersion', state: 'failed',
      attempt: 3, maxRetries: 3, useWorker: false,
      payload: null, wasScheduled: false
    }
    const historyChain = makeKnexChain(job)
    const insertMock = vi.fn().mockResolvedValue(1)
    const jobsChain = { insert: insertMock }

    WIKI.db.knex = vi.fn((table) => {
      if (table === 'jobHistory') return historyChain
      if (table === 'jobs') return jobsChain
      return makeKnexChain(null)
    })

    const result = await Mutation.retryJob({}, { id: 'j3' }, makeContext())
    expect(insertMock).toHaveBeenCalledOnce()
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SystemInfo field resolvers (pure / OS-based)
// ---------------------------------------------------------------------------

describe('SystemInfo field resolvers', () => {
  it('configFile returns path ending with config.yml', () => {
    const result = SystemInfo.configFile()
    expect(result).toMatch(/config\.yml$/)
    expect(path.isAbsolute(result)).toBe(true)
  })

  it('cpuCores returns a positive integer', () => {
    const result = SystemInfo.cpuCores()
    expect(result).toBe(os.cpus().length)
    expect(result).toBeGreaterThan(0)
  })

  it('currentVersion returns WIKI.version', () => {
    WIKI.version = '3.1.0'
    expect(SystemInfo.currentVersion()).toBe('3.1.0')
  })

  it('hostname returns a non-empty string', () => {
    const result = SystemInfo.hostname()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('nodeVersion returns a semver-like string without the leading v', () => {
    const result = SystemInfo.nodeVersion()
    expect(result).not.toMatch(/^v/)
    expect(result).toMatch(/^\d+\.\d+/)
  })

  it('ramTotal returns a human-readable string', () => {
    const result = SystemInfo.ramTotal()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('workingDirectory returns process.cwd()', () => {
    expect(SystemInfo.workingDirectory()).toBe(process.cwd())
  })

  it('httpRedirection returns false when not configured', () => {
    WIKI.config.server = {}
    WIKI.servers = { servers: { http: null, https: null } }
    expect(SystemInfo.httpRedirection()).toBe(false)
  })

  it('httpPort returns 0 when http server not running', () => {
    WIKI.servers = { servers: { http: null, https: null } }
    expect(SystemInfo.httpPort()).toBe(0)
  })

  it('httpsPort returns 0 when https server not running', () => {
    WIKI.servers = { servers: { http: null, https: null } }
    expect(SystemInfo.httpsPort()).toBe(0)
  })

  it('sslStatus always returns OK', () => {
    expect(SystemInfo.sslStatus()).toBe('OK')
  })

  it('isMailConfigured returns false for short/missing host', () => {
    WIKI.config.mail = { host: 'x' }
    expect(SystemInfo.isMailConfigured()).toBe(false)
  })

  it('isMailConfigured returns true for a real host', () => {
    WIKI.config.mail = { host: 'smtp.example.com' }
    expect(SystemInfo.isMailConfigured()).toBe(true)
  })

  it('upgradeCapable returns false when env var not set', async () => {
    delete process.env.UPGRADE_COMPANION
    const result = await SystemInfo.upgradeCapable()
    expect(result).toBe(false)
  })

  it('upgradeCapable returns true when env var is set', async () => {
    process.env.UPGRADE_COMPANION = '1'
    const result = await SystemInfo.upgradeCapable()
    expect(result).toBe(true)
    delete process.env.UPGRADE_COMPANION
  })

  it('dbHost returns WIKI.config.db.host', () => {
    WIKI.config.db = { host: 'db.local' }
    expect(SystemInfo.dbHost()).toBe('db.local')
  })

  it('dbVersion returns WIKI.db.VERSION', () => {
    WIKI.db.VERSION = '14.5'
    expect(SystemInfo.dbVersion()).toBe('14.5')
  })
})

// ---------------------------------------------------------------------------
// SystemInfo: SSL field resolvers
// ---------------------------------------------------------------------------

describe('SystemInfo SSL fields', () => {
  it('sslProvider returns null when ssl disabled', () => {
    WIKI.config.ssl = { enabled: false, provider: 'letsencrypt' }
    expect(SystemInfo.sslProvider()).toBeNull()
  })

  it('sslProvider returns provider when ssl enabled', () => {
    WIKI.config.ssl = { enabled: true, provider: 'letsencrypt' }
    expect(SystemInfo.sslProvider()).toBe('letsencrypt')
  })

  it('sslDomain returns null when ssl disabled', () => {
    WIKI.config.ssl = { enabled: false, provider: 'letsencrypt', domain: 'wiki.example.com' }
    expect(SystemInfo.sslDomain()).toBeNull()
  })

  it('sslDomain returns domain when ssl enabled with letsencrypt', () => {
    WIKI.config.ssl = { enabled: true, provider: 'letsencrypt', domain: 'wiki.example.com' }
    expect(SystemInfo.sslDomain()).toBe('wiki.example.com')
  })

  it('sslSubscriberEmail returns null when ssl disabled', () => {
    WIKI.config.ssl = { enabled: false, provider: 'letsencrypt', subscriberEmail: 'admin@example.com' }
    expect(SystemInfo.sslSubscriberEmail()).toBeNull()
  })

  it('sslSubscriberEmail returns email when ssl enabled with letsencrypt', () => {
    WIKI.config.ssl = { enabled: true, provider: 'letsencrypt', subscriberEmail: 'admin@example.com' }
    expect(SystemInfo.sslSubscriberEmail()).toBe('admin@example.com')
  })
})

// ---------------------------------------------------------------------------
// SystemInfo: DB-backed aggregate fields
// ---------------------------------------------------------------------------

describe('SystemInfo DB aggregate fields', () => {
  function makeQueryChain (total) {
    return {
      query: vi.fn().mockReturnValue({
        count: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total })
        }),
        whereRaw: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total })
        })
      })
    }
  }

  it('usersTotal returns integer count', async () => {
    WIKI.db.users = makeQueryChain('42')
    const result = await SystemInfo.usersTotal()
    expect(result).toBe(42)
  })

  it('pagesTotal returns integer count', async () => {
    WIKI.db.pages = makeQueryChain('100')
    const result = await SystemInfo.pagesTotal()
    expect(result).toBe(100)
  })

  it('groupsTotal returns integer count', async () => {
    WIKI.db.groups = makeQueryChain('5')
    const result = await SystemInfo.groupsTotal()
    expect(result).toBe(5)
  })

  it('tagsTotal returns integer count', async () => {
    WIKI.db.tags = makeQueryChain('20')
    const result = await SystemInfo.tagsTotal()
    expect(result).toBe(20)
  })

  it('loginsPastDay returns integer count', async () => {
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        count: vi.fn().mockReturnValue({
          whereRaw: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: '7' })
          })
        })
      })
    }
    const result = await SystemInfo.loginsPastDay()
    expect(result).toBe(7)
  })

  it('isSchedulerHealthy returns true when no failures', async () => {
    WIKI.db.knex = vi.fn().mockReturnValue({
      count: vi.fn().mockReturnValue({
        whereIn: vi.fn().mockReturnValue({
          andWhere: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: '0' })
          })
        })
      })
    })
    const result = await SystemInfo.isSchedulerHealthy()
    expect(result).toBe(true)
  })

  it('isSchedulerHealthy returns false when there are failures', async () => {
    WIKI.db.knex = vi.fn().mockReturnValue({
      count: vi.fn().mockReturnValue({
        whereIn: vi.fn().mockReturnValue({
          andWhere: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ total: '3' })
          })
        })
      })
    })
    const result = await SystemInfo.isSchedulerHealthy()
    expect(result).toBe(false)
  })
})
