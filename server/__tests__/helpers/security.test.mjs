import { describe, it, expect } from 'vitest'
import { generateToken, extractJWT } from '../../helpers/security.mjs'

describe('generateToken', () => {
  it('returns a hex string', async () => {
    const token = await generateToken(16)
    expect(token).toMatch(/^[a-f0-9]+$/)
  })

  it('returns token of correct length (bytes * 2 chars per byte)', async () => {
    const token = await generateToken(16)
    // 16 bytes -> 32 hex chars
    expect(token).toHaveLength(32)
  })

  it('returns different tokens on each call', async () => {
    const t1 = await generateToken(16)
    const t2 = await generateToken(16)
    expect(t1).not.toBe(t2)
  })

  it('generates token for 1 byte (2 hex chars)', async () => {
    const token = await generateToken(1)
    expect(token).toHaveLength(2)
  })

  it('generates token for 32 bytes (64 hex chars)', async () => {
    const token = await generateToken(32)
    expect(token).toHaveLength(64)
  })

  it('generates token for 64 bytes (128 hex chars)', async () => {
    const token = await generateToken(64)
    expect(token).toHaveLength(128)
  })
})

describe('extractJWT', () => {
  it('extracts JWT from Bearer Authorization header', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig'
    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
      path: '/api/pages'
    }
    expect(extractJWT(req)).toBe(token)
  })

  it('extracts JWT from cookie when no Authorization header', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.cookie.sig'
    const req = {
      headers: {},
      cookies: { jwt: token },
      path: '/api/pages'
    }
    expect(extractJWT(req)).toBe(token)
  })

  it('returns null/undefined when no token is present', () => {
    const req = {
      headers: {},
      cookies: {},
      path: '/api/pages'
    }
    // fromExtractors returns null or undefined when all extractors fail
    expect(extractJWT(req)).toBeFalsy()
  })

  it('prefers Authorization header over cookie', () => {
    const headerToken = 'header-token'
    const cookieToken = 'cookie-token'
    const req = {
      headers: { authorization: `Bearer ${headerToken}` },
      cookies: { jwt: cookieToken },
      path: '/api/pages'
    }
    expect(extractJWT(req)).toBe(headerToken)
  })

  it('returns null from cookie extractor when path is /u (force upload path)', () => {
    const cookieToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.upload.sig'
    const req = {
      headers: {},
      cookies: { jwt: cookieToken },
      path: '/u'
    }
    // Cookie extractor returns null for /u path; no bearer header either
    expect(extractJWT(req)).toBeNull()
  })

  it('returns null from cookie extractor for /U (case check)', () => {
    const cookieToken = 'some-token'
    const req = {
      headers: {},
      cookies: { jwt: cookieToken },
      path: '/U'
    }
    // path.toLowerCase() === '/u', so cookie returns null
    expect(extractJWT(req)).toBeNull()
  })

  it('still uses Bearer header even on /u path', () => {
    const headerToken = 'upload-bearer-token'
    const req = {
      headers: { authorization: `Bearer ${headerToken}` },
      cookies: { jwt: 'should-be-ignored' },
      path: '/u'
    }
    expect(extractJWT(req)).toBe(headerToken)
  })

  it('returns null when cookies object is missing', () => {
    const req = {
      headers: {},
      path: '/api/pages'
    }
    // req.cookies is undefined, cookie extractor returns null
    expect(extractJWT(req)).toBeNull()
  })
})
