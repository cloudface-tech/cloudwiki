import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('objection', () => {
  class Model {
    static get tableName () { return '' }
    static get jsonSchema () { return {} }
    static get jsonAttributes () { return [] }
    static query () {
      return {
        findOne: vi.fn(),
        where: vi.fn().mockReturnThis()
      }
    }
  }
  return { Model }
})

vi.mock('js-yaml', () => ({
  default: { load: vi.fn() },
  load: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue('')
  }
}))

vi.mock('../../helpers/common.mjs', () => ({
  parseModuleProps: vi.fn(props => props ?? {})
}))

import { Authentication } from '../../models/authentication.mjs'

// ---------------------------------------------------------------------------
// tableName
// ---------------------------------------------------------------------------
describe('Authentication.tableName', () => {
  it('is authentication', () => {
    expect(Authentication.tableName).toBe('authentication')
  })
})

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------
describe('Authentication.jsonSchema', () => {
  it('requires module field', () => {
    expect(Authentication.jsonSchema.required).toContain('module')
  })

  it('defines id, module, isEnabled, selfRegistration properties', () => {
    const props = Object.keys(Authentication.jsonSchema.properties)
    expect(props).toEqual(
      expect.arrayContaining(['id', 'module', 'isEnabled', 'selfRegistration'])
    )
  })

  it('module is of type string', () => {
    expect(Authentication.jsonSchema.properties.module.type).toBe('string')
  })

  it('isEnabled is of type boolean', () => {
    expect(Authentication.jsonSchema.properties.isEnabled.type).toBe('boolean')
  })

  it('selfRegistration is of type boolean', () => {
    expect(Authentication.jsonSchema.properties.selfRegistration.type).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// jsonAttributes
// ---------------------------------------------------------------------------
describe('Authentication.jsonAttributes', () => {
  it('includes config, domainWhitelist and autoEnrollGroups', () => {
    expect(Authentication.jsonAttributes).toEqual(
      expect.arrayContaining(['config', 'domainWhitelist', 'autoEnrollGroups'])
    )
  })
})

// ---------------------------------------------------------------------------
// getStrategy — delegates to db query
// ---------------------------------------------------------------------------
describe('Authentication.getStrategy', () => {
  beforeEach(() => {
    globalThis.WIKI.db = {
      authentication: {
        query: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue({ id: 'strat-1', module: 'local', isEnabled: true })
        })
      }
    }
  })

  it('calls findOne with the module name', async () => {
    const result = await Authentication.getStrategy('local')
    expect(WIKI.db.authentication.query().findOne).toHaveBeenCalledWith({ module: 'local' })
    expect(result).toMatchObject({ module: 'local' })
  })
})

// ---------------------------------------------------------------------------
// getStrategies — filtering logic
// ---------------------------------------------------------------------------
describe('Authentication.getStrategies', () => {
  beforeEach(() => {
    const mockWhere = vi.fn().mockResolvedValue([
      { id: 's1', module: 'local', isEnabled: true },
      { id: 's2', module: 'github', isEnabled: false }
    ])
    globalThis.WIKI.db = {
      authentication: {
        query: vi.fn().mockReturnValue({ where: mockWhere })
      }
    }
  })

  it('calls query().where({}) when enabledOnly is false', async () => {
    await Authentication.getStrategies({ enabledOnly: false })
    expect(WIKI.db.authentication.query().where).toHaveBeenCalledWith({})
  })

  it('calls query().where({ isEnabled: true }) when enabledOnly is true', async () => {
    await Authentication.getStrategies({ enabledOnly: true })
    expect(WIKI.db.authentication.query().where).toHaveBeenCalledWith({ isEnabled: true })
  })

  it('defaults to enabledOnly=false when no argument provided', async () => {
    await Authentication.getStrategies()
    expect(WIKI.db.authentication.query().where).toHaveBeenCalledWith({})
  })
})

// ---------------------------------------------------------------------------
// refreshStrategiesFromDisk — graceful error handling
// ---------------------------------------------------------------------------
describe('Authentication.refreshStrategiesFromDisk', () => {
  it('logs an error and does not throw when fs operations fail', async () => {
    const fs = await import('node:fs/promises')
    fs.default.readdir.mockRejectedValue(new Error('ENOENT'))

    globalThis.WIKI.SERVERPATH = '/fake/path'
    globalThis.WIKI.data = { ...globalThis.WIKI.data, authentication: [] }

    await expect(Authentication.refreshStrategiesFromDisk()).resolves.toBeUndefined()
    expect(WIKI.logger.error).toHaveBeenCalled()
  })

  it('initialises WIKI.data.authentication as empty array when no dirs', async () => {
    const fs = await import('node:fs/promises')
    fs.default.readdir.mockResolvedValue([])

    globalThis.WIKI.SERVERPATH = '/fake/path'
    globalThis.WIKI.data = { ...globalThis.WIKI.data, authentication: undefined }

    await Authentication.refreshStrategiesFromDisk()
    expect(Array.isArray(WIKI.data.authentication)).toBe(true)
    expect(WIKI.data.authentication.length).toBe(0)
  })
})
