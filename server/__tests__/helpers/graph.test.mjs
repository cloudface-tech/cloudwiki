import { describe, it, expect } from 'vitest'
import { generateSuccess, generateError } from '../../helpers/graph.mjs'

describe('generateSuccess', () => {
  it('returns succeeded: true', () => {
    const result = generateSuccess('Done')
    expect(result.succeeded).toBe(true)
  })

  it('returns errorCode: 0', () => {
    const result = generateSuccess('Done')
    expect(result.errorCode).toBe(0)
  })

  it('returns slug: ok', () => {
    const result = generateSuccess('Done')
    expect(result.slug).toBe('ok')
  })

  it('returns the provided message', () => {
    const result = generateSuccess('Operation complete')
    expect(result.message).toBe('Operation complete')
  })

  it('uses default message when no argument is passed', () => {
    const result = generateSuccess()
    expect(result.message).toBe('Operation succeeded.')
  })

  it('uses default message when null is passed', () => {
    const result = generateSuccess(null)
    expect(result.message).toBe('Operation succeeded.')
  })

  it('returns empty string message if explicitly passed', () => {
    // defaultTo('', ...) — empty string is not nil so it is used as-is
    const result = generateSuccess('')
    expect(result.message).toBe('')
  })
})

describe('generateError', () => {
  it('returns succeeded: false', () => {
    const err = { name: 'TestError', message: 'test', code: 42 }
    const result = generateError(err)
    expect(result.operation.succeeded).toBe(false)
  })

  it('wraps in operation key by default (complete=true)', () => {
    const err = { name: 'SomeError', message: 'oops', code: 1 }
    const result = generateError(err)
    expect(result).toHaveProperty('operation')
  })

  it('does not wrap in operation when complete=false', () => {
    const err = { name: 'SomeError', message: 'oops', code: 1 }
    const result = generateError(err, false)
    expect(result).not.toHaveProperty('operation')
    expect(result.succeeded).toBe(false)
  })

  it('uses numeric error code from err.code', () => {
    const err = { name: 'CodedError', message: 'x', code: 99 }
    const result = generateError(err, false)
    expect(result.errorCode).toBe(99)
  })

  it('defaults errorCode to 1 when code is not finite', () => {
    const err = { name: 'NaNError', message: 'x', code: NaN }
    const result = generateError(err, false)
    expect(result.errorCode).toBe(1)
  })

  it('defaults errorCode to 1 when code is a string', () => {
    const err = { name: 'StrError', message: 'x', code: 'abc' }
    const result = generateError(err, false)
    expect(result.errorCode).toBe(1)
  })

  it('defaults errorCode to 1 when code is missing', () => {
    const err = { name: 'NoCode', message: 'no code here' }
    const result = generateError(err, false)
    expect(result.errorCode).toBe(1)
  })

  it('returns the error name as slug', () => {
    const err = { name: 'PageNotFound', message: 'not found', code: 404 }
    const result = generateError(err, false)
    expect(result.slug).toBe('PageNotFound')
  })

  it('returns the error message', () => {
    const err = { name: 'SomeError', message: 'Something went wrong', code: 5 }
    const result = generateError(err, false)
    expect(result.message).toBe('Something went wrong')
  })

  it('uses default message when err.message is missing', () => {
    const err = { name: 'EmptyMsg', code: 1 }
    const result = generateError(err, false)
    expect(result.message).toBe('An unexpected error occured.')
  })

  it('handles Error instances', () => {
    const err = new Error('native error')
    err.code = 7
    const result = generateError(err, false)
    expect(result.message).toBe('native error')
    expect(result.errorCode).toBe(7)
  })
})
