import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDeferred,
  decodeTreePath,
  encodeTreePath,
  generateHash,
  getTypeDefaultValue,
  parseModuleProps,
  getDictNameFromLocale
} from '../../helpers/common.mjs'

describe('createDeferred', () => {
  it('returns an object with resolve, reject, promise', () => {
    const d = createDeferred()
    expect(d).toHaveProperty('resolve')
    expect(d).toHaveProperty('reject')
    expect(d).toHaveProperty('promise')
    expect(d.promise).toBeInstanceOf(Promise)
  })

  it('resolves the promise when resolve() is called', async () => {
    const d = createDeferred()
    d.resolve('hello')
    const val = await d.promise
    expect(val).toBe('hello')
  })

  it('rejects the promise when reject() is called', async () => {
    const d = createDeferred()
    d.reject(new Error('fail'))
    await expect(d.promise).rejects.toThrow('fail')
  })

  it('resolve before promise is created still resolves', async () => {
    const d = createDeferred()
    d.resolve(42)
    const val = await d.promise
    expect(val).toBe(42)
  })
})

describe('decodeTreePath', () => {
  it('replaces dots with slashes', () => {
    expect(decodeTreePath('foo.bar.baz')).toBe('foo/bar/baz')
  })

  it('handles a path with no dots', () => {
    expect(decodeTreePath('foobar')).toBe('foobar')
  })

  it('handles empty string', () => {
    expect(decodeTreePath('')).toBe('')
  })

  it('handles null gracefully (returns undefined)', () => {
    expect(decodeTreePath(null)).toBeUndefined()
  })

  it('handles undefined gracefully', () => {
    expect(decodeTreePath(undefined)).toBeUndefined()
  })

  it('handles multiple consecutive dots', () => {
    expect(decodeTreePath('a..b')).toBe('a//b')
  })
})

describe('encodeTreePath', () => {
  it('lowercases and replaces slashes with dots', () => {
    expect(encodeTreePath('Foo/Bar/Baz')).toBe('foo.bar.baz')
  })

  it('handles path with no slashes', () => {
    expect(encodeTreePath('hello')).toBe('hello')
  })

  it('returns empty string for empty input', () => {
    expect(encodeTreePath('')).toBe('')
  })

  it('returns empty string for null', () => {
    expect(encodeTreePath(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(encodeTreePath(undefined)).toBe('')
  })

  it('lowercases uppercase letters', () => {
    expect(encodeTreePath('ABC/DEF')).toBe('abc.def')
  })

  it('handles mixed slashes and dots', () => {
    expect(encodeTreePath('a/b.c/d')).toBe('a.b.c.d')
  })
})

describe('generateHash', () => {
  it('returns a hex string', () => {
    const hash = generateHash('hello')
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('returns a 40-character SHA-1 hash', () => {
    const hash = generateHash('test')
    expect(hash).toHaveLength(40)
  })

  it('is deterministic for the same input', () => {
    expect(generateHash('same')).toBe(generateHash('same'))
  })

  it('differs for different inputs', () => {
    expect(generateHash('abc')).not.toBe(generateHash('def'))
  })

  it('handles empty string', () => {
    const hash = generateHash('')
    expect(hash).toHaveLength(40)
  })

  it('handles special characters', () => {
    const hash = generateHash('!@#$%^&*()')
    expect(hash).toHaveLength(40)
  })
})

describe('getTypeDefaultValue', () => {
  it('returns empty string for string type', () => {
    expect(getTypeDefaultValue('string')).toBe('')
  })

  it('returns 0 for number type', () => {
    expect(getTypeDefaultValue('number')).toBe(0)
  })

  it('returns false for boolean type', () => {
    expect(getTypeDefaultValue('boolean')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(getTypeDefaultValue('String')).toBe('')
    expect(getTypeDefaultValue('NUMBER')).toBe(0)
    expect(getTypeDefaultValue('Boolean')).toBe(false)
  })

  it('returns undefined for unknown types', () => {
    expect(getTypeDefaultValue('array')).toBeUndefined()
  })
})

describe('parseModuleProps', () => {
  it('transforms simple string type props', () => {
    const result = parseModuleProps({ myProp: 'string' })
    expect(result.myProp).toMatchObject({
      default: '',
      type: 'string',
      title: 'My Prop'
    })
  })

  it('transforms simple number type props', () => {
    const result = parseModuleProps({ count: 'number' })
    expect(result.count.default).toBe(0)
    expect(result.count.type).toBe('number')
  })

  it('transforms simple boolean type props', () => {
    const result = parseModuleProps({ enabled: 'boolean' })
    expect(result.enabled.default).toBe(false)
  })

  it('uses provided default value from object definition', () => {
    const result = parseModuleProps({ name: { type: 'string', default: 'wiki' } })
    expect(result.name.default).toBe('wiki')
  })

  it('uses provided title from object definition', () => {
    const result = parseModuleProps({ myKey: { type: 'string', title: 'Custom Title' } })
    expect(result.myKey.title).toBe('Custom Title')
  })

  it('sets hint, enum, sensitive, multiline defaults', () => {
    const result = parseModuleProps({ x: 'string' })
    expect(result.x.hint).toBe('')
    expect(result.x.enum).toBe(false)
    expect(result.x.sensitive).toBe(false)
    expect(result.x.multiline).toBe(false)
  })

  it('handles empty props object', () => {
    const result = parseModuleProps({})
    expect(result).toEqual({})
  })

  it('handles object with explicit null default falling back to type default', () => {
    const result = parseModuleProps({ val: { type: 'number', default: null } })
    // isNil(null) is true, so falls back to getTypeDefaultValue('number') = 0
    expect(result.val.default).toBe(0)
  })

  it('preserves enum values', () => {
    const result = parseModuleProps({ mode: { type: 'string', enum: ['a', 'b'] } })
    expect(result.mode.enum).toEqual(['a', 'b'])
  })
})

describe('getDictNameFromLocale', () => {
  beforeEach(() => {
    WIKI.config.search.dictOverrides = {}
  })

  it('returns mapped dict for known locale', () => {
    expect(getDictNameFromLocale('en')).toBe('english')
  })

  it('returns mapped dict for portuguese', () => {
    expect(getDictNameFromLocale('pt')).toBe('portuguese')
  })

  it('returns simple for unknown locale', () => {
    expect(getDictNameFromLocale('zh')).toBe('simple')
  })

  it('truncates locale to 2 chars before lookup', () => {
    expect(getDictNameFromLocale('en-US')).toBe('english')
  })

  it('uses dictOverrides when set', () => {
    WIKI.config.search.dictOverrides = { en: 'custom_english' }
    expect(getDictNameFromLocale('en')).toBe('custom_english')
  })

  it('dictOverride takes precedence over tsDictMappings', () => {
    WIKI.config.search.dictOverrides = { pt: 'override_pt' }
    expect(getDictNameFromLocale('pt')).toBe('override_pt')
  })

  it('locale override works with full locale string', () => {
    WIKI.config.search.dictOverrides = { fr: 'custom_french' }
    expect(getDictNameFromLocale('fr-BE')).toBe('custom_french')
  })

  it('returns simple for unknown locale without override', () => {
    expect(getDictNameFromLocale('xx')).toBe('simple')
  })
})
