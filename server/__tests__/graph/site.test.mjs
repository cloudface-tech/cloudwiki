import { describe, it, expect, vi, beforeEach } from 'vitest'
import resolvers from '../../graph/resolvers/site.mjs'

const { Query, Mutation, SiteLocales } = resolvers

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext (overrides = {}) {
  return {
    req: {
      user: { id: 42 },
      isAuthenticated: true,
      ...overrides.req
    },
    ...overrides
  }
}

function makeSite (overrides = {}) {
  return {
    id: 'site-1',
    hostname: 'wiki.example.com',
    isEnabled: true,
    config: {
      title: 'My Wiki',
      pageExtensions: ['md', 'html'],
      assets: { logo: null, favicon: null, loginBg: null },
      uploads: { normalizeFilename: false },
      ...overrides.config
    },
    ...overrides
  }
}

function makeQueryChain (finalValue) {
  const chain = {
    orderBy: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    first: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    patch: vi.fn().mockReturnThis(),
    then (resolve, reject) {
      return Promise.resolve(finalValue).then(resolve, reject)
    }
  }
  return chain
}

// ---------------------------------------------------------------------------
// Query: sites
// ---------------------------------------------------------------------------

describe('Query.sites', () => {
  it('returns all sites ordered by hostname with flattened config', async () => {
    const fakeSites = [
      makeSite({ id: 'site-1', hostname: 'a.example.com' }),
      makeSite({ id: 'site-2', hostname: 'b.example.com', config: { title: 'B Wiki', pageExtensions: ['md'], assets: {}, uploads: {} } })
    ]
    const chain = makeQueryChain(fakeSites)
    WIKI.db.sites = { query: vi.fn().mockReturnValue(chain) }

    const result = await Query.sites()
    expect(result).toHaveLength(2)
    expect(result[0].hostname).toBe('a.example.com')
    expect(result[0].id).toBe('site-1')
    expect(result[0].title).toBe('My Wiki')
    // pageExtensions array should be joined to a string
    expect(result[0].pageExtensions).toBe('md, html')
  })
})

// ---------------------------------------------------------------------------
// Query: siteById
// ---------------------------------------------------------------------------

describe('Query.siteById', () => {
  it('returns null when site not found', async () => {
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }
    const result = await Query.siteById({}, { id: 'nonexistent' })
    expect(result).toBeNull()
  })

  it('returns flattened site when found', async () => {
    const site = makeSite()
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(site) })
    }

    const result = await Query.siteById({}, { id: 'site-1' })
    expect(result.id).toBe('site-1')
    expect(result.title).toBe('My Wiki')
    expect(result.pageExtensions).toBe('md, html')
  })
})

// ---------------------------------------------------------------------------
// Query: siteByHostname
// ---------------------------------------------------------------------------

describe('Query.siteByHostname', () => {
  it('returns null when no site matches and exact is true', async () => {
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null)
      })
    }

    const result = await Query.siteByHostname({}, { hostname: 'unknown.example.com', exact: true })
    expect(result).toBeNull()
  })

  it('falls back to wildcard site when not found and exact is false', async () => {
    const wildcardSite = makeSite({ id: 'wild', hostname: '*' })
    let callCount = 0
    WIKI.db.sites = {
      query: vi.fn(() => {
        return {
          where: vi.fn().mockReturnThis(),
          first: vi.fn(() => {
            callCount++
            return callCount === 1 ? Promise.resolve(null) : Promise.resolve(wildcardSite)
          })
        }
      })
    }

    const result = await Query.siteByHostname({}, { hostname: 'unknown.example.com', exact: false })
    expect(result.id).toBe('wild')
    expect(result.hostname).toBe('*')
  })

  it('returns site directly when hostname matches', async () => {
    const site = makeSite()
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(site)
      })
    }

    const result = await Query.siteByHostname({}, { hostname: 'wiki.example.com', exact: true })
    expect(result.id).toBe('site-1')
    expect(result.pageExtensions).toBe('md, html')
  })
})

// ---------------------------------------------------------------------------
// Mutation: createSite
// ---------------------------------------------------------------------------

describe('Mutation.createSite', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.Error = {
      Custom: class extends Error {
        constructor (code, msg) { super(msg); this.code = code }
      }
    }
  })

  it('returns error when user lacks write:sites permission', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.createSite({}, { hostname: 'new.example.com', title: 'New Site' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })

  it('returns error when hostname is invalid', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    // Empty hostname fails the length check
    const result = await Mutation.createSite({}, { hostname: '', title: 'Test' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/Invalid Site Hostname/)
  })

  it('returns error when title is empty', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const result = await Mutation.createSite({}, { hostname: 'new.example.com', title: '' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/Invalid Site Title/)
  })

  it('returns error when catch-all hostname already exists', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const existingSite = makeSite({ hostname: '*' })
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(existingSite)
      })
    }

    const result = await Mutation.createSite({}, { hostname: '*', title: 'Catch All' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/catch-all hostname/)
  })

  it('creates site and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const newSite = makeSite({ id: 'new-site' })
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null)
      }),
      createSite: vi.fn().mockResolvedValue(newSite)
    }

    const result = await Mutation.createSite({}, { hostname: 'new.example.com', title: 'New Site' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.site.id).toBe('new-site')
  })
})

// ---------------------------------------------------------------------------
// Mutation: updateSite
// ---------------------------------------------------------------------------

describe('Mutation.updateSite', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.Error = {
      Custom: class extends Error {
        constructor (code, msg) { super(msg); this.code = code }
      }
    }
  })

  it('returns error when user lacks manage:sites permission', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.updateSite({}, { id: 'site-1', patch: {} }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })

  it('returns error when site not found', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }
    const result = await Mutation.updateSite({}, { id: 'nonexistent', patch: {} }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/Invalid Site ID/)
  })

  it('returns error when hostname patch is blank', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const site = makeSite()
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(site) })
    }
    const result = await Mutation.updateSite({}, { id: 'site-1', patch: { hostname: '   ' } }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/Hostname is invalid/)
  })

  it('returns error when changing to catch-all and one already exists', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const site = makeSite({ hostname: 'wiki.example.com' })
    const dupSite = makeSite({ id: 'existing-wild', hostname: '*', config: { title: 'Existing Wild', pageExtensions: [], assets: {}, uploads: {} } })

    let callCount = 0
    WIKI.db.sites = {
      query: vi.fn(() => {
        callCount++
        if (callCount === 1) return { findById: vi.fn().mockResolvedValue(site) }
        return {
          where: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(dupSite)
        }
      }),
      updateSite: vi.fn()
    }

    const result = await Mutation.updateSite({}, { id: 'site-1', patch: { hostname: '*' } }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/catch-all hostname/)
  })

  it('updates site and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const site = makeSite()
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(site) }),
      updateSite: vi.fn().mockResolvedValue(undefined)
    }

    const result = await Mutation.updateSite({}, { id: 'site-1', patch: { title: 'Updated Title' } }, makeContext())
    expect(WIKI.db.sites.updateSite).toHaveBeenCalledOnce()
    expect(result.operation.succeeded).toBe(true)
  })

  it('converts pageExtensions string to array on update', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const site = makeSite()
    const updateMock = vi.fn().mockResolvedValue(undefined)
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(site) }),
      updateSite: updateMock
    }

    await Mutation.updateSite({}, { id: 'site-1', patch: { pageExtensions: 'md, html, txt' } }, makeContext())
    expect(updateMock).toHaveBeenCalledWith('site-1', expect.objectContaining({
      config: expect.objectContaining({ pageExtensions: ['md', 'html', 'txt'] })
    }))
  })
})

// ---------------------------------------------------------------------------
// Mutation: deleteSite
// ---------------------------------------------------------------------------

describe('Mutation.deleteSite', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.Error = {
      Custom: class extends Error {
        constructor (code, msg) { super(msg); this.code = code }
      }
    }
  })

  it('returns error when user lacks manage:sites permission', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.deleteSite({}, { id: 'site-1' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })

  it('prevents deleting the last site', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        count: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: '1' })
      })
    }

    const result = await Mutation.deleteSite({}, { id: 'site-1' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/Cannot delete the last site/)
  })

  it('deletes site and returns success when more than 1 site exists', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        count: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: '3' })
      }),
      deleteSite: vi.fn().mockResolvedValue(undefined)
    }

    const result = await Mutation.deleteSite({}, { id: 'site-2' }, makeContext())
    expect(WIKI.db.sites.deleteSite).toHaveBeenCalledWith('site-2')
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SiteLocales type resolver
// ---------------------------------------------------------------------------

describe('SiteLocales.active', () => {
  it('maps locale codes to cache entries', async () => {
    const enLocale = { code: 'en', name: 'English' }
    const ptLocale = { code: 'pt', name: 'Portuguese' }
    WIKI.cache = {
      get: vi.fn(key => key === 'locale:en' ? enLocale : ptLocale)
    }

    const result = await SiteLocales.active({ active: ['en', 'pt'] }, {}, makeContext())
    expect(result).toEqual([enLocale, ptLocale])
    expect(WIKI.cache.get).toHaveBeenCalledWith('locale:en')
    expect(WIKI.cache.get).toHaveBeenCalledWith('locale:pt')
  })

  it('returns empty array when no active locales', async () => {
    WIKI.cache = { get: vi.fn() }
    const result = await SiteLocales.active({ active: [] }, {}, makeContext())
    expect(result).toEqual([])
  })
})
