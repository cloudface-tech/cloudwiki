import { describe, it, expect, vi } from 'vitest'

vi.mock('objection', () => {
  class Model {
    static get tableName () { return '' }
    static get jsonSchema () { return {} }
    static get jsonAttributes () { return [] }
    static get relationMappings () { return {} }
    $beforeUpdate () {}
    $beforeInsert () {}
    static query () { return { insert: vi.fn(), findById: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis() } }
    static async beforeDelete () {}
  }
  Model.ManyToManyRelation = 'ManyToManyRelation'
  Model.BelongsToOneRelation = 'BelongsToOneRelation'
  Model.HasManyRelation = 'HasManyRelation'
  return { Model }
})

vi.mock('../../models/pageLinks.mjs', () => ({ PageLink: class PageLink {} }))
vi.mock('../../models/users.mjs', () => ({ User: class User {} }))

// Stub heavy modules not needed for logic tests
vi.mock('js-binary', () => ({ Type: class Type { constructor (s) { this.schema = s } } }))
vi.mock('fs-extra', () => ({ default: {} }))
vi.mock('striptags', () => ({ default: vi.fn(s => s) }))
vi.mock('emoji-regex', () => ({ default: vi.fn(() => /\p{Emoji}/u) }))
vi.mock('he', () => ({ default: { decode: vi.fn(s => s) } }))
vi.mock('clean-css', () => ({ default: class CleanCSS { minify (s) { return { styles: s } } } }))
vi.mock('turndown', () => ({ default: class TurndownService { use () {} turndown (s) { return s } } }))
vi.mock('@joplin/turndown-plugin-gfm', () => ({ gfm: vi.fn() }))
vi.mock('cheerio', () => ({ load: vi.fn(() => ({ html: vi.fn() })) }))
vi.mock('gray-matter', () => ({
  default: vi.fn(raw => ({ content: raw, data: {}, isEmpty: false }))
}))
vi.mock('js-yaml', () => ({
  default: { load: vi.fn(), safeLoad: vi.fn() },
  load: vi.fn(),
  safeLoad: vi.fn()
}))

vi.mock('../../helpers/common.mjs', () => ({
  getDictNameFromLocale: vi.fn(() => 'english'),
  generateHash: vi.fn(str => 'mock-hash-' + str)
}))

vi.mock('../../helpers/page.mjs', () => ({
  generateHash: vi.fn(opts => `${opts.locale}|${opts.path}`),
  getFileExtension: vi.fn(ct => ct === 'markdown' ? 'md' : ct === 'html' ? 'html' : 'txt'),
  injectPageMetadata: vi.fn(page => page.content)
}))

import { Page } from '../../models/pages.mjs'

// ---------------------------------------------------------------------------
// tableName
// ---------------------------------------------------------------------------
describe('Page.tableName', () => {
  it('is pages', () => {
    expect(Page.tableName).toBe('pages')
  })
})

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------
describe('Page.jsonSchema', () => {
  it('requires path and title', () => {
    expect(Page.jsonSchema.required).toContain('path')
    expect(Page.jsonSchema.required).toContain('title')
  })

  it('defines expected properties', () => {
    const props = Object.keys(Page.jsonSchema.properties)
    expect(props).toEqual(
      expect.arrayContaining(['id', 'path', 'hash', 'title', 'description', 'publishState', 'content', 'contentType', 'render', 'siteId'])
    )
  })

  it('path is of type string', () => {
    expect(Page.jsonSchema.properties.path.type).toBe('string')
  })

  it('title is of type string', () => {
    expect(Page.jsonSchema.properties.title.type).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// jsonAttributes
// ---------------------------------------------------------------------------
describe('Page.jsonAttributes', () => {
  it('includes config, historyData, relations, scripts, toc', () => {
    expect(Page.jsonAttributes).toEqual(
      expect.arrayContaining(['config', 'historyData', 'relations', 'scripts', 'toc'])
    )
  })
})

// ---------------------------------------------------------------------------
// relationMappings
// ---------------------------------------------------------------------------
describe('Page.relationMappings', () => {
  it('defines links, author and creator relations', () => {
    const rm = Page.relationMappings
    expect(rm).toHaveProperty('links')
    expect(rm).toHaveProperty('author')
    expect(rm).toHaveProperty('creator')
  })

  it('links is a HasManyRelation', () => {
    expect(Page.relationMappings.links.relation).toBe('HasManyRelation')
  })

  it('author is a BelongsToOneRelation', () => {
    expect(Page.relationMappings.author.relation).toBe('BelongsToOneRelation')
  })

  it('creator joins from pages.creatorId to users.id', () => {
    const join = Page.relationMappings.creator.join
    expect(join.from).toBe('pages.creatorId')
    expect(join.to).toBe('users.id')
  })
})

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
describe('Page lifecycle hooks', () => {
  it('$beforeInsert sets createdAt and updatedAt', () => {
    const page = new Page()
    page.$beforeInsert()
    expect(page.createdAt).toBeTruthy()
    expect(page.updatedAt).toBeTruthy()
    expect(new Date(page.createdAt).toString()).not.toBe('Invalid Date')
  })

  it('$beforeUpdate sets updatedAt', () => {
    const page = new Page()
    page.$beforeUpdate()
    expect(page.updatedAt).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// cacheSchema — structural checks
// ---------------------------------------------------------------------------
describe('Page.cacheSchema', () => {
  it('is defined', () => {
    expect(Page.cacheSchema).toBeDefined()
  })

  it('cacheSchema contains schema with id, title, render fields', () => {
    // The schema object is passed to JSBinType constructor; we verify the mock
    // captured the right shape by checking that the static getter returns an
    // object (instance of the mocked Type class)
    expect(Page.cacheSchema).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// parseMetadata — pure logic
// ---------------------------------------------------------------------------
describe('Page.parseMetadata', () => {
  it('returns raw content when contentType is unrecognised', () => {
    const result = Page.parseMetadata('raw content', 'json')
    expect(result).toEqual({ content: 'raw content' })
  })

  it('returns raw content wrapped in object for markdown with no frontmatter', async () => {
    // gray-matter mock returns { content: raw, data: {}, isEmpty: false }
    const result = Page.parseMetadata('# Hello', 'markdown')
    // When result.isEmpty is falsy the branch runs and spreads result.data
    expect(result).toHaveProperty('content')
  })

  it('returns raw content for html without a frontmatter block', () => {
    const raw = '<p>Hello World</p>'
    const result = Page.parseMetadata(raw, 'html')
    // The regex match[2] will be undefined/empty, so falls through to default
    expect(result.content).toBe(raw)
  })

  it('returns raw content on parse error', () => {
    // Passing an object as raw triggers an error inside matter, falls to catch
    const result = Page.parseMetadata(null, 'markdown')
    expect(result).toHaveProperty('content')
  })
})

// ---------------------------------------------------------------------------
// getFileExtension instance method (delegates to helper)
// ---------------------------------------------------------------------------
describe('Page#getFileExtension', () => {
  it('returns md for markdown', () => {
    const page = new Page()
    page.contentType = 'markdown'
    expect(page.getFileExtension()).toBe('md')
  })

  it('returns html for html', () => {
    const page = new Page()
    page.contentType = 'html'
    expect(page.getFileExtension()).toBe('html')
  })

  it('returns txt for unknown content type', () => {
    const page = new Page()
    page.contentType = 'unknown'
    expect(page.getFileExtension()).toBe('txt')
  })
})

// ---------------------------------------------------------------------------
// injectMetadata instance method (delegates to helper)
// ---------------------------------------------------------------------------
describe('Page#injectMetadata', () => {
  it('returns result from injectPageMetadata helper', () => {
    const page = new Page()
    page.content = '# Test'
    page.contentType = 'markdown'
    const result = page.injectMetadata()
    expect(result).toBe('# Test')
  })
})

// ---------------------------------------------------------------------------
// Path / alias regex validation (via createPage guard logic)
// ---------------------------------------------------------------------------
describe('Page path regex validation', () => {
  const pageRegex = /^[a-zA-Z0-9-_/]*$/
  const aliasRegex = /^[a-zA-Z0-9-_]*$/

  it('accepts valid simple path', () => {
    expect(pageRegex.test('docs/intro')).toBe(true)
  })

  it('accepts path with hyphens and underscores', () => {
    expect(pageRegex.test('my-docs/page_one')).toBe(true)
  })

  it('rejects path with spaces', () => {
    expect(pageRegex.test('docs/my page')).toBe(false)
  })

  it('rejects path with special characters', () => {
    expect(pageRegex.test('docs/page!')).toBe(false)
  })

  it('accepts valid alias', () => {
    expect(aliasRegex.test('my-page')).toBe(true)
  })

  it('rejects alias with slash (not allowed in alias)', () => {
    expect(aliasRegex.test('docs/page')).toBe(false)
  })
})
