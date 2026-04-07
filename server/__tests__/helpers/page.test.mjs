import { describe, it, expect } from 'vitest'
import {
  parsePath,
  generateHash,
  injectPageMetadata,
  isReservedPath,
  getFileExtension,
  getContentType
} from '../../helpers/page.mjs'

describe('parsePath', () => {
  it('returns default path for empty string', () => {
    const result = parsePath('')
    expect(result.path).toBe('home')
    expect(result.locale).toBe('en')
    expect(result.explicitLocale).toBe(false)
  })

  it('parses a simple path', () => {
    const result = parsePath('docs/intro')
    expect(result.path).toBe('docs/intro')
    expect(result.explicitLocale).toBe(false)
  })

  it('extracts locale prefix when present', () => {
    const result = parsePath('fr/docs/intro')
    expect(result.locale).toBe('fr')
    expect(result.path).toBe('docs/intro')
    expect(result.explicitLocale).toBe(true)
  })

  it('extracts regional locale like en-US', () => {
    const result = parsePath('en-US/home')
    expect(result.locale).toBe('en-US')
    expect(result.explicitLocale).toBe(true)
  })

  it('strips leading slash', () => {
    const result = parsePath('/docs/page')
    expect(result.path).toBe('docs/page')
  })

  it('strips underscore-prefixed first segment', () => {
    const result = parsePath('_private/docs/page')
    expect(result.path).toBe('docs/page')
  })

  it('path traversal: strips double dots', () => {
    const result = parsePath('docs/../etc/passwd')
    expect(result.path).not.toContain('..')
  })

  it('path traversal: strips backslashes', () => {
    const result = parsePath('docs\\..\\etc')
    expect(result.path).not.toContain('\\')
  })

  it('path traversal: strips double slashes', () => {
    const result = parsePath('docs//page')
    expect(result.path).not.toContain('//')
  })

  it('removes unsafe control characters', () => {
    const result = parsePath('docs/\x00page')
    expect(result.path).not.toContain('\x00')
  })

  it('removes the first unsafe char (regex has no g flag, only removes first match)', () => {
    // unsafeCharsRegex has no g flag: only the first match '<' is removed
    // 'docs/<page>:*?' -> 'docs/page>:*?' (only '<' removed)
    const result = parsePath('docs/<page>:*?')
    expect(result.path).not.toContain('<')
  })

  it('strips file extension when stripExt option is set', () => {
    const result = parsePath('docs/intro.md', { stripExt: true })
    expect(result.path).toBe('docs/intro')
  })

  it('does not strip extension when stripExt is false', () => {
    const result = parsePath('docs/intro.md', { stripExt: false })
    expect(result.path).toBe('docs/intro.md')
  })

  it('filters out empty and dot-only segments', () => {
    const result = parsePath('docs/./page')
    expect(result.path).toBe('docs/page')
  })

  it('strips only the first unsafe control char (no g flag) — remaining chars pass through', () => {
    // unsafeCharsRegex has no g flag: '\x00' is removed, '\x01\x02' remain
    // rawPath is not empty after that, so it does NOT reset to 'home'
    const result = parsePath('\x00\x01\x02')
    expect(result.path).not.toContain('\x00')
  })

  it('handles URL-encoded paths', () => {
    const result = parsePath('docs%2Fintro')
    // qs.unescape decodes %2F -> /
    expect(result.path).toBe('docs/intro')
  })
})

describe('page.generateHash', () => {
  it('returns a 40-character hex string', () => {
    const hash = generateHash({ locale: 'en', path: 'home', privateNS: '' })
    expect(hash).toHaveLength(40)
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('is deterministic', () => {
    const opts = { locale: 'en', path: 'docs/intro', privateNS: 'ns1' }
    expect(generateHash(opts)).toBe(generateHash(opts))
  })

  it('differs for different locales', () => {
    const a = generateHash({ locale: 'en', path: 'home', privateNS: '' })
    const b = generateHash({ locale: 'fr', path: 'home', privateNS: '' })
    expect(a).not.toBe(b)
  })

  it('differs for different paths', () => {
    const a = generateHash({ locale: 'en', path: 'home', privateNS: '' })
    const b = generateHash({ locale: 'en', path: 'about', privateNS: '' })
    expect(a).not.toBe(b)
  })

  it('differs for different privateNS', () => {
    const a = generateHash({ locale: 'en', path: 'home', privateNS: 'ns1' })
    const b = generateHash({ locale: 'en', path: 'home', privateNS: 'ns2' })
    expect(a).not.toBe(b)
  })
})

describe('injectPageMetadata', () => {
  const basePage = {
    title: 'Test Page',
    description: 'A description',
    isPublished: true,
    updatedAt: '2024-01-01',
    tags: [{ tag: 'tag1' }, { tag: 'tag2' }],
    editorKey: 'markdown',
    createdAt: '2023-01-01',
    content: '# Hello'
  }

  it('injects YAML front matter for markdown', () => {
    const page = { ...basePage, contentType: 'markdown' }
    const result = injectPageMetadata(page)
    expect(result).toMatch(/^---\n/)
    expect(result).toContain('title: Test Page')
    expect(result).toContain('tags: tag1, tag2')
    expect(result).toContain('---\n\n# Hello')
  })

  it('injects HTML comment front matter for html', () => {
    const page = { ...basePage, contentType: 'html', content: '<p>hi</p>' }
    const result = injectPageMetadata(page)
    expect(result).toMatch(/^<!--\n/)
    expect(result).toContain('title: Test Page')
    expect(result).toContain('-->\n\n<p>hi</p>')
  })

  it('injects _meta for json content type', () => {
    const page = { ...basePage, contentType: 'json', content: { key: 'val' } }
    const result = injectPageMetadata(page)
    expect(result).toHaveProperty('_meta')
    expect(result._meta.title).toBe('Test Page')
    expect(result.key).toBe('val')
  })

  it('returns raw content for unknown content types', () => {
    const page = { ...basePage, contentType: 'unknown', content: 'raw text' }
    const result = injectPageMetadata(page)
    expect(result).toBe('raw text')
  })

  it('handles empty tags array', () => {
    const page = { ...basePage, contentType: 'markdown', tags: [] }
    const result = injectPageMetadata(page)
    expect(result).toContain('tags: ')
  })

  it('handles null tags', () => {
    const page = { ...basePage, contentType: 'markdown', tags: null }
    const result = injectPageMetadata(page)
    expect(result).toContain('tags: ')
  })

  it('includes published as string', () => {
    const page = { ...basePage, contentType: 'markdown', isPublished: false }
    const result = injectPageMetadata(page)
    expect(result).toContain('published: false')
  })
})

describe('isReservedPath', () => {
  it('returns true for reserved path _admin', () => {
    expect(isReservedPath('_admin')).toBe(true)
  })

  it('returns true for reserved path login', () => {
    expect(isReservedPath('login')).toBe(true)
  })

  it('returns true for reserved path logout', () => {
    expect(isReservedPath('logout')).toBe(true)
  })

  it('returns true for reserved path register', () => {
    expect(isReservedPath('register')).toBe(true)
  })

  it('returns true for reserved path _assets', () => {
    expect(isReservedPath('_assets')).toBe(true)
  })

  it('returns true for reserved path _site', () => {
    expect(isReservedPath('_site')).toBe(true)
  })

  it('returns false for non-reserved path', () => {
    expect(isReservedPath('docs')).toBe(false)
  })

  it('returns false for non-reserved nested path', () => {
    expect(isReservedPath('docs/intro')).toBe(false)
  })

  it('returns true for empty first segment', () => {
    expect(isReservedPath('')).toBe(true)
  })

  it('returns true when first segment looks like a locale', () => {
    expect(isReservedPath('en/some-page')).toBe(true)
    expect(isReservedPath('fr/page')).toBe(true)
  })

  it('returns true for reserved path nested under a path', () => {
    // only the first section is checked
    expect(isReservedPath('login/reset')).toBe(true)
  })
})

describe('getFileExtension', () => {
  it('returns md for markdown', () => {
    expect(getFileExtension('markdown')).toBe('md')
  })

  it('returns html for html', () => {
    expect(getFileExtension('html')).toBe('html')
  })

  it('returns txt for unknown type', () => {
    expect(getFileExtension('unknown')).toBe('txt')
  })

  it('returns txt for empty string', () => {
    expect(getFileExtension('')).toBe('txt')
  })
})

describe('getContentType', () => {
  it('returns markdown for .md file', () => {
    expect(getContentType('page.md')).toBe('markdown')
  })

  it('returns html for .html file', () => {
    expect(getContentType('page.html')).toBe('html')
  })

  it('returns false for unknown extension', () => {
    expect(getContentType('page.txt')).toBe(false)
  })

  it('returns false for file with no extension', () => {
    expect(getContentType('pagefile')).toBe(false)
  })

  it('handles nested paths', () => {
    expect(getContentType('docs/intro.md')).toBe('markdown')
  })

  it('returns false for unknown extension like .json', () => {
    expect(getContentType('data.json')).toBe(false)
  })
})
