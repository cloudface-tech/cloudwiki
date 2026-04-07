import { describe, it, expect, vi, beforeEach } from 'vitest'
import resolvers from '../../graph/resolvers/page.mjs'

const { Query, Mutation, Page } = resolvers

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

function makeQueryChain (finalValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    findOne: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    column: vi.fn().mockReturnThis(),
    withGraphJoined: vi.fn().mockReturnThis(),
    modifyGraph: vi.fn().mockReturnThis(),
    modify: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    patch: vi.fn().mockReturnThis(),
    deleteById: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(finalValue),
    then (resolve, reject) {
      return Promise.resolve(finalValue).then(resolve, reject)
    }
  }
  return chain
}

// ---------------------------------------------------------------------------
// Query: pageById
// ---------------------------------------------------------------------------

describe('Query.pageById', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_PAGE_NOT_FOUND when page does not exist', async () => {
    WIKI.db.pages = { getPageFromDb: vi.fn().mockResolvedValue(null) }
    await expect(Query.pageById({}, { id: 99 }, makeContext())).rejects.toThrow('ERR_PAGE_NOT_FOUND')
  })

  it('throws ERR_FORBIDDEN when user has no read access', async () => {
    WIKI.db.pages = {
      getPageFromDb: vi.fn().mockResolvedValue({
        id: 1, path: 'home', locale: 'en', config: {}, scripts: {}
      })
    }
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.pageById({}, { id: 1 }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns page with flattened config and scripts when access granted', async () => {
    const page = {
      id: 1,
      path: 'home',
      locale: 'en',
      title: 'Home',
      config: { tocDepth: { min: 1, max: 3 } },
      scripts: { css: '.body{}', jsLoad: 'console.log(1)', jsUnload: '' }
    }
    WIKI.db.pages = { getPageFromDb: vi.fn().mockResolvedValue(page) }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.pageById({}, { id: 1 }, makeContext())
    expect(result.id).toBe(1)
    expect(result.scriptCss).toBe('.body{}')
    expect(result.scriptJsLoad).toBe('console.log(1)')
    expect(result.scriptJsUnload).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Query: pageByPath
// ---------------------------------------------------------------------------

describe('Query.pageByPath', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_PAGE_NOT_FOUND when page does not exist', async () => {
    WIKI.db.pages = { getPageFromDb: vi.fn().mockResolvedValue(null) }
    await expect(Query.pageByPath({}, { path: 'en/home', siteId: 'site-1' }, makeContext())).rejects.toThrow('ERR_PAGE_NOT_FOUND')
  })

  it('throws ERR_FORBIDDEN when user has no read access', async () => {
    WIKI.db.pages = {
      getPageFromDb: vi.fn().mockResolvedValue({
        id: 1, path: 'home', locale: 'en', config: {}, scripts: {}
      })
    }
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.pageByPath({}, { path: 'en/home', siteId: 'site-1' }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns page when access granted', async () => {
    const page = {
      id: 2, path: 'about', locale: 'en', title: 'About',
      config: {}, scripts: {}
    }
    WIKI.db.pages = { getPageFromDb: vi.fn().mockResolvedValue(page) }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.pageByPath({}, { path: 'en/about', siteId: 'site-1' }, makeContext())
    expect(result.id).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Query: pages (list)
// ---------------------------------------------------------------------------

describe('Query.pages', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('filters out pages the user cannot read', async () => {
    const fakePages = [
      { id: 1, path: 'public', locale: 'en', tags: [{ tag: 'news' }] },
      { id: 2, path: 'private', locale: 'en', tags: [] }
    ]

    const chain = makeQueryChain(fakePages)
    chain.modify = vi.fn(fn => {
      fn({ limit: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis() })
      return chain
    })
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }

    // Only allow access to the first page
    WIKI.auth.checkAccess.mockImplementation((user, perms, { path }) => path === 'public')

    const result = await Query.pages({}, {}, makeContext())
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('maps tags to plain strings', async () => {
    const fakePages = [
      { id: 1, path: 'home', locale: 'en', tags: [{ tag: 'news' }, { tag: 'wiki' }] }
    ]
    const chain = makeQueryChain(fakePages)
    chain.modify = vi.fn(fn => {
      fn({ limit: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis() })
      return chain
    })
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.pages({}, {}, makeContext())
    expect(result[0].tags).toEqual(['news', 'wiki'])
  })
})

// ---------------------------------------------------------------------------
// Query: tags
// ---------------------------------------------------------------------------

describe('Query.tags', () => {
  it('throws when siteId is missing', async () => {
    await expect(Query.tags({}, {}, makeContext())).rejects.toThrow('Missing Site ID')
  })

  it('returns tags for a given siteId', async () => {
    const fakeTags = [{ id: 1, tag: 'news', siteId: 'site-1' }]
    const chain = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(fakeTags)
    }
    WIKI.db = { knex: vi.fn().mockReturnValue(chain) }

    const result = await Query.tags({}, { siteId: 'site-1' }, makeContext())
    expect(result).toEqual(fakeTags)
  })
})

// ---------------------------------------------------------------------------
// Query: pathFromAlias
// ---------------------------------------------------------------------------

describe('Query.pathFromAlias', () => {
  beforeEach(() => {
    WIKI.sites = {}
  })

  it('throws ERR_PAGE_ALIAS_MISSING when alias is empty', async () => {
    await expect(Query.pathFromAlias({}, { alias: '  ', siteId: 'site-1' }, makeContext())).rejects.toThrow('ERR_PAGE_ALIAS_MISSING')
  })

  it('throws ERR_INVALID_SITE when site does not exist', async () => {
    WIKI.sites = {}
    await expect(Query.pathFromAlias({}, { alias: 'my-alias', siteId: 'nonexistent' }, makeContext())).rejects.toThrow('ERR_INVALID_SITE')
  })

  it('throws ERR_PAGE_ALIAS_NOT_FOUND when no page matches', async () => {
    WIKI.sites = { 'site-1': { config: { localeNamespacing: false } } }
    const chain = {
      findOne: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue(null)
    }
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    await expect(Query.pathFromAlias({}, { alias: 'ghost', siteId: 'site-1' }, makeContext())).rejects.toThrow('ERR_PAGE_ALIAS_NOT_FOUND')
  })

  it('returns path without locale prefix when localeNamespacing is false', async () => {
    WIKI.sites = { 'site-1': { config: { localeNamespacing: false } } }
    const fakePage = { id: 5, path: 'home', locale: 'en' }
    const chain = {
      findOne: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue(fakePage)
    }
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    const result = await Query.pathFromAlias({}, { alias: 'home-alias', siteId: 'site-1' }, makeContext())
    expect(result.path).toBe('home')
    expect(result.id).toBe(5)
  })

  it('returns path with locale prefix when localeNamespacing is true', async () => {
    WIKI.sites = { 'site-1': { config: { localeNamespacing: true } } }
    const fakePage = { id: 7, path: 'docs', locale: 'en' }
    const chain = {
      findOne: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue(fakePage)
    }
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    const result = await Query.pathFromAlias({}, { alias: 'docs-alias', siteId: 'site-1' }, makeContext())
    expect(result.path).toBe('en/docs')
  })
})

// ---------------------------------------------------------------------------
// Query: checkConflicts
// ---------------------------------------------------------------------------

describe('Query.checkConflicts', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.Error = {
      PageUpdateForbidden: class extends Error { constructor () { super('ERR_PAGE_UPDATE_FORBIDDEN') } },
      PageNotFound: class extends Error { constructor () { super('ERR_PAGE_NOT_FOUND') } }
    }
  })

  it('throws PageNotFound when page does not exist', async () => {
    const chain = makeQueryChain(null)
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    await expect(Query.checkConflicts({}, { id: 99, checkoutDate: new Date() }, makeContext())).rejects.toThrow('ERR_PAGE_NOT_FOUND')
  })

  it('throws PageUpdateForbidden when user lacks write:pages permission', async () => {
    const page = { path: 'home', locale: 'en', updatedAt: new Date() }
    const chain = makeQueryChain(page)
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.checkConflicts({}, { id: 1, checkoutDate: new Date() }, makeContext())).rejects.toThrow('ERR_PAGE_UPDATE_FORBIDDEN')
  })

  it('returns true when page was updated after checkout date', async () => {
    const page = { path: 'home', locale: 'en', updatedAt: new Date('2025-01-02') }
    const chain = makeQueryChain(page)
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.checkConflicts({}, { id: 1, checkoutDate: new Date('2025-01-01') }, makeContext())
    expect(result).toBe(true)
  })

  it('returns false when page was not updated since checkout', async () => {
    const page = { path: 'home', locale: 'en', updatedAt: new Date('2025-01-01') }
    const chain = makeQueryChain(page)
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain) }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.checkConflicts({}, { id: 1, checkoutDate: new Date('2025-06-01') }, makeContext())
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mutation: createPage
// ---------------------------------------------------------------------------

describe('Mutation.createPage', () => {
  it('returns success with page on creation', async () => {
    const newPage = { id: 10, path: 'new-page', locale: 'en', title: 'New Page' }
    WIKI.db.pages = { createPage: vi.fn().mockResolvedValue(newPage) }

    const result = await Mutation.createPage({}, { title: 'New Page', path: 'new-page', locale: 'en' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.page.id).toBe(10)
  })

  it('returns error when createPage throws ERR_PAGE_DUPLICATE_PATH', async () => {
    WIKI.db.pages = { createPage: vi.fn().mockRejectedValue(new Error('ERR_PAGE_DUPLICATE_PATH')) }

    const result = await Mutation.createPage({}, { title: 'Test', path: 'existing', locale: 'en' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_PAGE_DUPLICATE_PATH/)
  })

  it('passes user from context to createPage', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 11 })
    WIKI.db.pages = { createPage: createMock }

    const ctx = makeContext({ req: { user: { id: 99 }, isAuthenticated: true } })
    await Mutation.createPage({}, { title: 'Test', path: 'test', locale: 'en' }, ctx)
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 99 } }))
  })
})

// ---------------------------------------------------------------------------
// Mutation: updatePage
// ---------------------------------------------------------------------------

describe('Mutation.updatePage', () => {
  it('returns success on update', async () => {
    const updated = { id: 1, path: 'home', title: 'Updated Home' }
    WIKI.db.pages = { updatePage: vi.fn().mockResolvedValue(updated) }

    const result = await Mutation.updatePage({}, { id: 1, title: 'Updated Home' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.page.id).toBe(1)
  })

  it('returns error when updatePage throws ERR_FORBIDDEN', async () => {
    WIKI.db.pages = { updatePage: vi.fn().mockRejectedValue(new Error('ERR_FORBIDDEN')) }

    const result = await Mutation.updatePage({}, { id: 1, title: 'X' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: deletePage
// ---------------------------------------------------------------------------

describe('Mutation.deletePage', () => {
  it('returns success on delete', async () => {
    WIKI.db.pages = { deletePage: vi.fn().mockResolvedValue(undefined) }

    const result = await Mutation.deletePage({}, { id: 1 }, makeContext())
    expect(result.operation.succeeded).toBe(true)
  })

  it('returns error when deletePage throws ERR_FORBIDDEN', async () => {
    WIKI.db.pages = { deletePage: vi.fn().mockRejectedValue(new Error('ERR_FORBIDDEN')) }

    const result = await Mutation.deletePage({}, { id: 1 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: movePage
// ---------------------------------------------------------------------------

describe('Mutation.movePage', () => {
  it('returns success when move succeeds', async () => {
    WIKI.db.pages = { movePage: vi.fn().mockResolvedValue(undefined) }

    const result = await Mutation.movePage({}, { id: 1, destinationPath: 'new-path', destinationLocale: 'en' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
  })

  it('returns error when movePage throws', async () => {
    WIKI.db.pages = { movePage: vi.fn().mockRejectedValue(new Error('ERR_PAGE_MOVE_FAILED')) }

    const result = await Mutation.movePage({}, { id: 1, destinationPath: 'x' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_PAGE_MOVE_FAILED/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: rerenderPage
// ---------------------------------------------------------------------------

describe('Mutation.rerenderPage', () => {
  beforeEach(() => {
    WIKI.Error = {
      PageNotFound: class extends Error { constructor () { super('ERR_PAGE_NOT_FOUND') } }
    }
  })

  it('returns error when page not found', async () => {
    const chain = makeQueryChain(null)
    WIKI.db.pages = {
      query: vi.fn().mockReturnValue(chain),
      renderPage: vi.fn()
    }

    const result = await Mutation.rerenderPage({}, { id: 999 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_PAGE_NOT_FOUND/)
  })

  it('rerenders page and returns success', async () => {
    const page = { id: 1, path: 'home', locale: 'en' }
    const chain = makeQueryChain(page)
    const renderMock = vi.fn().mockResolvedValue(undefined)
    WIKI.db.pages = {
      query: vi.fn().mockReturnValue(chain),
      renderPage: renderMock
    }

    const result = await Mutation.rerenderPage({}, { id: 1 }, makeContext())
    expect(renderMock).toHaveBeenCalledWith(page)
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: deleteTag
// ---------------------------------------------------------------------------

describe('Mutation.deleteTag', () => {
  it('returns error when tag not found', async () => {
    const chain = makeQueryChain(null)
    WIKI.db.tags = { query: vi.fn().mockReturnValue(chain) }

    const result = await Mutation.deleteTag({}, { id: 99 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/does not exist/)
  })

  it('unrelates pages and deletes tag on success', async () => {
    const tag = {
      $relatedQuery: vi.fn().mockReturnValue({ unrelate: vi.fn().mockResolvedValue(1) })
    }
    const deleteChain = { deleteById: vi.fn().mockResolvedValue(1) }
    WIKI.db.tags = {
      query: vi.fn()
        .mockReturnValueOnce({ ...makeQueryChain(tag), findById: vi.fn().mockResolvedValue(tag) })
        .mockReturnValueOnce(deleteChain)
    }

    const result = await Mutation.deleteTag({}, { id: 1 }, makeContext())
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: updateTag
// ---------------------------------------------------------------------------

describe('Mutation.updateTag', () => {
  it('returns error when tag does not exist (0 rows affected)', async () => {
    const chain = {
      findById: vi.fn().mockReturnThis(),
      patch: vi.fn().mockResolvedValue(0)
    }
    WIKI.db.tags = { query: vi.fn().mockReturnValue(chain) }

    const result = await Mutation.updateTag({}, { id: 99, tag: 'foo', title: 'Foo' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/does not exist/)
  })

  it('normalises tag to lowercase and trims whitespace', async () => {
    const patchMock = vi.fn().mockResolvedValue(1)
    const chain = {
      findById: vi.fn().mockReturnThis(),
      patch: patchMock
    }
    WIKI.db.tags = { query: vi.fn().mockReturnValue(chain) }

    await Mutation.updateTag({}, { id: 1, tag: '  NEWS  ', title: '  Breaking News  ' }, makeContext())
    expect(patchMock).toHaveBeenCalledWith({ tag: 'news', title: 'Breaking News' })
  })
})

// ---------------------------------------------------------------------------
// Mutation: flushCache
// ---------------------------------------------------------------------------

describe('Mutation.flushCache', () => {
  it('calls pages.flushCache, emits event, returns success', async () => {
    WIKI.db.pages = { flushCache: vi.fn().mockResolvedValue(undefined) }
    WIKI.events = { outbound: { emit: vi.fn() } }

    const result = await Mutation.flushCache({}, {}, makeContext())
    expect(WIKI.db.pages.flushCache).toHaveBeenCalledOnce()
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('flushCache')
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: rebuildPageTree
// ---------------------------------------------------------------------------

describe('Mutation.rebuildPageTree', () => {
  it('calls pages.rebuildTree and returns success', async () => {
    WIKI.db.pages = { rebuildTree: vi.fn().mockResolvedValue(undefined) }

    const result = await Mutation.rebuildPageTree({}, {}, makeContext())
    expect(WIKI.db.pages.rebuildTree).toHaveBeenCalledOnce()
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: migrateToLocale
// ---------------------------------------------------------------------------

describe('Mutation.migrateToLocale', () => {
  it('returns success with page count on locale migration', async () => {
    WIKI.db.pages = { migrateToLocale: vi.fn().mockResolvedValue(42) }

    const result = await Mutation.migrateToLocale({}, { sourceLocale: 'en', targetLocale: 'pt' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.count).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// Mutation: restorePage
// ---------------------------------------------------------------------------

describe('Mutation.restorePage', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.Error = {
      PageNotFound: class extends Error { constructor () { super('ERR_PAGE_NOT_FOUND') } },
      PageRestoreForbidden: class extends Error { constructor () { super('ERR_PAGE_RESTORE_FORBIDDEN') } }
    }
  })

  it('returns error when page not found', async () => {
    const chain = makeQueryChain(null)
    WIKI.db.pages = {
      query: vi.fn().mockReturnValue(chain),
      updatePage: vi.fn()
    }
    WIKI.db.pageHistory = { getVersion: vi.fn() }

    const result = await Mutation.restorePage({}, { pageId: 99, versionId: 1 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('returns error when user lacks write:pages permission', async () => {
    const page = { path: 'home', locale: 'en' }
    const chain = makeQueryChain(page)
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain), updatePage: vi.fn() }
    WIKI.db.pageHistory = { getVersion: vi.fn() }
    WIKI.auth.checkAccess.mockReturnValue(false)

    const result = await Mutation.restorePage({}, { pageId: 1, versionId: 1 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_PAGE_RESTORE_FORBIDDEN/)
  })

  it('restores page version and returns success', async () => {
    const page = { path: 'home', locale: 'en' }
    const version = { pageId: 1, content: 'old content', title: 'Old Title' }
    const chain = makeQueryChain(page)
    const updateMock = vi.fn().mockResolvedValue(undefined)
    WIKI.db.pages = { query: vi.fn().mockReturnValue(chain), updatePage: updateMock }
    WIKI.db.pageHistory = { getVersion: vi.fn().mockResolvedValue(version) }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Mutation.restorePage({}, { pageId: 1, versionId: 5 }, makeContext())
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Page type resolvers
// ---------------------------------------------------------------------------

describe('Page type resolvers', () => {
  describe('Page.icon', () => {
    it('returns default icon when none set', () => {
      expect(Page.icon({ path: 'test' })).toBe('las la-file-alt')
    })

    it('returns custom icon when set', () => {
      expect(Page.icon({ icon: 'fas fa-star' })).toBe('fas fa-star')
    })
  })

  describe('Page.password', () => {
    it('returns redacted string when password is set', () => {
      expect(Page.password({ password: 'secret123' })).toBe('********')
    })

    it('returns empty string when no password', () => {
      expect(Page.password({ password: null })).toBe('')
      expect(Page.password({})).toBe('')
    })
  })

  describe('Page.content', () => {
    beforeEach(() => {
      WIKI.auth.checkAccess = vi.fn()
    })

    it('throws ERR_FORBIDDEN when user lacks read:source permission', () => {
      WIKI.auth.checkAccess.mockReturnValue(false)
      expect(() => Page.content({ path: 'home', locale: 'en', content: 'secret' }, {}, makeContext()))
        .toThrow('ERR_FORBIDDEN')
    })

    it('returns content when user has read:source permission', () => {
      WIKI.auth.checkAccess.mockReturnValue(true)
      const result = Page.content({ path: 'home', locale: 'en', content: '# Hello' }, {}, makeContext())
      expect(result).toBe('# Hello')
    })
  })

  describe('Page.tocDepth', () => {
    it('returns min/max from extra.tocDepth when set', () => {
      const result = Page.tocDepth({ extra: { tocDepth: { min: 2, max: 4 } } })
      expect(result).toEqual({ min: 2, max: 4 })
    })

    it('returns defaults (1, 2) when extra.tocDepth is not set', () => {
      const result = Page.tocDepth({})
      expect(result).toEqual({ min: 1, max: 2 })
    })
  })
})

// ---------------------------------------------------------------------------
// Query: searchPages — input validation
// ---------------------------------------------------------------------------

describe('Query.searchPages input validation', () => {
  it('throws when siteId is missing', async () => {
    await expect(Query.searchPages({}, { query: 'test', siteId: null }, makeContext()))
      .rejects.toThrow('Missing Site ID')
  })

  it('throws when offset is negative', async () => {
    await expect(Query.searchPages({}, { query: 'test', siteId: 's-1', offset: -1 }, makeContext()))
      .rejects.toThrow('Invalid offset value.')
  })

  it('throws when limit exceeds 100', async () => {
    await expect(Query.searchPages({}, { query: 'test', siteId: 's-1', limit: 200 }, makeContext()))
      .rejects.toThrow('Limit must be between 1 and 100.')
  })
})
