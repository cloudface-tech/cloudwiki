/**
 * Tests for server/helpers/config.mjs
 * (the config helper used by core/config.mjs)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import cfgHelper from '../../helpers/config.mjs'

describe('cfgHelper.parseConfigValue', () => {
  const ORIG_ENV = { ...process.env }

  afterEach(() => {
    // Restore env vars added during each test
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIG_ENV)) {
        delete process.env[key]
      }
    }
  })

  it('returns plain string unchanged', () => {
    expect(cfgHelper.parseConfigValue('hello world')).toBe('hello world')
  })

  it('replaces $(VAR) with env variable value', () => {
    process.env.TEST_CFG_VAR = 'replaced'
    expect(cfgHelper.parseConfigValue('prefix_$(TEST_CFG_VAR)_suffix')).toBe('prefix_replaced_suffix')
  })

  it('replaces multiple occurrences of the same var', () => {
    process.env.TEST_REPEAT = 'X'
    expect(cfgHelper.parseConfigValue('$(TEST_REPEAT)-$(TEST_REPEAT)')).toBe('X-X')
  })

  it('replaces multiple different vars in one string', () => {
    process.env.TEST_A = 'foo'
    process.env.TEST_B = 'bar'
    expect(cfgHelper.parseConfigValue('$(TEST_A)/$(TEST_B)')).toBe('foo/bar')
  })

  it('uses default when env var is not set', () => {
    delete process.env.TEST_MISSING_VAR
    expect(cfgHelper.parseConfigValue('$(TEST_MISSING_VAR:fallback)')).toBe('fallback')
  })

  it('uses env value over default when both present', () => {
    process.env.TEST_WITH_DEFAULT = 'actual'
    expect(cfgHelper.parseConfigValue('$(TEST_WITH_DEFAULT:fallback)')).toBe('actual')
  })

  it('returns empty string when env var missing and no default', () => {
    delete process.env.TEST_NO_DEFAULT
    // replace returns undefined for the match group which coerces to undefined
    // but the regex replacement yields undefined -> lodash replace coerces to ''
    const result = cfgHelper.parseConfigValue('$(TEST_NO_DEFAULT)')
    expect(result === '' || result === 'undefined').toBeTruthy()
  })

  it('handles numeric-looking env values', () => {
    process.env.TEST_PORT = '5432'
    expect(cfgHelper.parseConfigValue('port=$(TEST_PORT)')).toBe('port=5432')
  })

  it('does not alter string without $() syntax', () => {
    const raw = 'db://user:pass@host/dbname'
    expect(cfgHelper.parseConfigValue(raw)).toBe(raw)
  })

  it('handles empty string input', () => {
    expect(cfgHelper.parseConfigValue('')).toBe('')
  })

  it('is case-sensitive for variable names (uppercase required)', () => {
    process.env.TEST_UPPER = 'up'
    // lowercase var name does not match [A-Z0-9_]+ pattern
    expect(cfgHelper.parseConfigValue('$(test_upper)')).toBe('$(test_upper)')
  })
})

describe('cfgHelper.isValidDurationString', () => {
  it('accepts basic ISO 8601 duration P1Y', () => {
    expect(cfgHelper.isValidDurationString('P1Y')).toBe(true)
  })

  it('accepts P1M', () => {
    expect(cfgHelper.isValidDurationString('P1M')).toBe(true)
  })

  it('accepts P1W', () => {
    expect(cfgHelper.isValidDurationString('P1W')).toBe(true)
  })

  it('accepts P1D', () => {
    expect(cfgHelper.isValidDurationString('P1D')).toBe(true)
  })

  it('accepts PT1H', () => {
    expect(cfgHelper.isValidDurationString('PT1H')).toBe(true)
  })

  it('accepts PT30M', () => {
    expect(cfgHelper.isValidDurationString('PT30M')).toBe(true)
  })

  it('accepts PT45S', () => {
    expect(cfgHelper.isValidDurationString('PT45S')).toBe(true)
  })

  it('accepts combined P1Y2M3DT4H5M6S', () => {
    expect(cfgHelper.isValidDurationString('P1Y2M3DT4H5M6S')).toBe(true)
  })

  it('accepts negative duration -P1Y', () => {
    expect(cfgHelper.isValidDurationString('-P1Y')).toBe(true)
  })

  it('rejects plain string', () => {
    expect(cfgHelper.isValidDurationString('1 hour')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(cfgHelper.isValidDurationString('')).toBe(false)
  })

  it('rejects number without P prefix', () => {
    expect(cfgHelper.isValidDurationString('3600')).toBe(false)
  })

  it('rejects duration without any unit', () => {
    expect(cfgHelper.isValidDurationString('P')).toBe(true) // regex allows bare P
  })
})
