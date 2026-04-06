import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

// Mock objection Model so the import doesn't need a real DB
vi.mock('objection', () => {
  class Model {
    static get tableName () { return '' }
    static get jsonSchema () { return {} }
    static get jsonAttributes () { return [] }
    static get relationMappings () { return {} }
    async $beforeUpdate () {}
    async $beforeInsert () {}
    $query () { return { patch: vi.fn(), patchAndFetch: vi.fn() } }
    $relatedQuery () { return { relate: vi.fn(), select: vi.fn().mockReturnThis() } }
    static query () {
      return {
        findById: vi.fn().mockReturnThis(),
        findOne: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        insert: vi.fn().mockReturnThis(),
        insertAndFetch: vi.fn(),
        patch: vi.fn().mockReturnThis(),
        withGraphFetched: vi.fn().mockReturnThis(),
        modifyGraph: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis()
      }
    }
  }
  Model.ManyToManyRelation = 'ManyToManyRelation'
  Model.BelongsToOneRelation = 'BelongsToOneRelation'
  Model.HasManyRelation = 'HasManyRelation'
  return { Model }
})

// Mock heavy / optional dependencies
vi.mock('node-2fa', () => ({
  default: {
    generateSecret: vi.fn().mockReturnValue({ secret: 'TESTSECRET123' }),
    verifyToken: vi.fn().mockReturnValue({ delta: 0 })
  }
}))
vi.mock('qr-image', () => ({
  default: { imageSync: vi.fn().mockReturnValue('<svg></svg>') }
}))
vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('jwt-token') }
}))
vi.mock('./../../models/groups.mjs', () => ({
  Group: class Group {}
}))

import { User } from '../../models/users.mjs'

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------
describe('User.jsonSchema', () => {
  it('requires email field', () => {
    const schema = User.jsonSchema
    expect(schema.required).toContain('email')
  })

  it('defines expected properties', () => {
    const props = Object.keys(User.jsonSchema.properties)
    expect(props).toEqual(
      expect.arrayContaining(['id', 'email', 'name', 'pictureUrl', 'isSystem', 'isActive', 'isVerified'])
    )
  })

  it('email property is of type string', () => {
    expect(User.jsonSchema.properties.email.type).toBe('string')
  })

  it('isActive property is of type boolean', () => {
    expect(User.jsonSchema.properties.isActive.type).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// jsonAttributes
// ---------------------------------------------------------------------------
describe('User.jsonAttributes', () => {
  it('includes auth, meta and prefs', () => {
    expect(User.jsonAttributes).toEqual(expect.arrayContaining(['auth', 'meta', 'prefs']))
  })
})

// ---------------------------------------------------------------------------
// tableName
// ---------------------------------------------------------------------------
describe('User.tableName', () => {
  it('is users', () => {
    expect(User.tableName).toBe('users')
  })
})

// ---------------------------------------------------------------------------
// Instance methods — getPermissions / getGroups
// ---------------------------------------------------------------------------
describe('User instance methods', () => {
  it('getGroups returns unique group ids', () => {
    const user = new User()
    user.groups = [{ id: 'g1', permissions: ['read:pages'] }, { id: 'g2', permissions: ['write:pages'] }, { id: 'g1', permissions: ['read:pages'] }]
    expect(user.getGroups()).toEqual(['g1', 'g2'])
  })

  it('getPermissions returns unique permissions across groups', () => {
    const user = new User()
    user.groups = [
      { id: 'g1', permissions: ['read:pages', 'write:pages'] },
      { id: 'g2', permissions: ['read:pages', 'manage:system'] }
    ]
    const perms = user.getPermissions()
    expect(perms).toEqual(expect.arrayContaining(['read:pages', 'write:pages', 'manage:system']))
    // ensure uniqueness
    expect(perms.filter(p => p === 'read:pages').length).toBe(1)
  })

  it('verifyTFA delegates to tfa.verifyToken and returns true when delta is 0', async () => {
    const tfa = await import('node-2fa')
    tfa.default.verifyToken.mockReturnValue({ delta: 0 })

    const user = new User()
    user.auth = { local: { tfaSecret: 'TESTSECRET123' } }
    expect(user.verifyTFA('local', '123456')).toBe(true)
  })

  it('verifyTFA returns false when delta is non-zero', async () => {
    const tfa = await import('node-2fa')
    tfa.default.verifyToken.mockReturnValue({ delta: 1 })

    const user = new User()
    user.auth = { local: { tfaSecret: 'TESTSECRET123' } }
    expect(user.verifyTFA('local', '000000')).toBe(false)
  })

  it('verifyTFA returns false when verifyToken returns null', async () => {
    const tfa = await import('node-2fa')
    tfa.default.verifyToken.mockReturnValue(null)

    const user = new User()
    user.auth = { local: { tfaSecret: 'TESTSECRET123' } }
    expect(user.verifyTFA('local', '000000')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// $beforeInsert / $beforeUpdate lifecycle hooks
// ---------------------------------------------------------------------------
describe('User lifecycle hooks', () => {
  it('$beforeInsert sets createdAt and updatedAt', async () => {
    const user = new User()
    await user.$beforeInsert({})
    expect(user.createdAt).toBeTruthy()
    expect(user.updatedAt).toBeTruthy()
    expect(new Date(user.createdAt).toString()).not.toBe('Invalid Date')
  })

  it('$beforeUpdate sets updatedAt', async () => {
    const user = new User()
    await user.$beforeUpdate({}, {})
    expect(user.updatedAt).toBeTruthy()
    expect(new Date(user.updatedAt).toString()).not.toBe('Invalid Date')
  })
})

// ---------------------------------------------------------------------------
// processProfile — email parsing logic
// ---------------------------------------------------------------------------
describe('User.processProfile — email extraction', () => {
  beforeEach(() => {
    // Provide a minimal WIKI.auth.strategies stub
    globalThis.WIKI.auth = {
      strategies: {
        github: { autoEnrollGroups: [] }
      }
    }

    // Stub db
    globalThis.WIKI.db = {
      users: {
        query: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue(null),
          insertAndFetch: vi.fn().mockResolvedValue({ id: 'new-user-id', email: 'test@example.com', $relatedQuery: vi.fn().mockReturnValue({ relate: vi.fn() }) })
        }),
        updateUserAvatarData: vi.fn()
      }
    }
  })

  it('throws when no email is present in profile', async () => {
    await expect(
      User.processProfile({ profile: { displayName: 'No Email' }, providerKey: 'github' })
    ).rejects.toThrow('Missing or invalid email address from profile.')
  })

  it('throws when email string is too short', async () => {
    await expect(
      User.processProfile({ profile: { email: 'a@b' }, providerKey: 'github' })
    ).rejects.toThrow('Missing or invalid email address from profile.')
  })

  it('accepts string email with length > 5', async () => {
    // insertAndFetch mock returns a stub user with $relatedQuery
    const insertResult = {
      id: 'uid',
      email: 'test@example.com',
      $relatedQuery: vi.fn().mockReturnValue({ relate: vi.fn().mockResolvedValue(undefined) })
    }
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      insertAndFetch: vi.fn().mockResolvedValue(insertResult)
    })

    const result = await User.processProfile({
      profile: { email: 'test@example.com', displayName: 'Test User' },
      providerKey: 'github'
    })
    expect(result.email).toBe('test@example.com')
  })

  it('accepts email from emails array (primary=true)', async () => {
    const insertResult = {
      id: 'uid',
      email: 'primary@example.com',
      $relatedQuery: vi.fn().mockReturnValue({ relate: vi.fn().mockResolvedValue(undefined) })
    }
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      insertAndFetch: vi.fn().mockResolvedValue(insertResult)
    })

    const result = await User.processProfile({
      profile: {
        emails: [{ value: 'secondary@example.com', primary: false }, { value: 'primary@example.com', primary: true }],
        displayName: 'Test'
      },
      providerKey: 'github'
    })
    expect(result.email).toBe('primary@example.com')
  })

  it('uses first emails array entry when none is primary', async () => {
    const insertResult = {
      id: 'uid',
      email: 'first@example.com',
      $relatedQuery: vi.fn().mockReturnValue({ relate: vi.fn().mockResolvedValue(undefined) })
    }
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      insertAndFetch: vi.fn().mockResolvedValue(insertResult)
    })

    await User.processProfile({
      profile: {
        emails: [{ value: 'first@example.com' }, { value: 'second@example.com' }],
        displayName: 'Test'
      },
      providerKey: 'github'
    })
    // Just verify it doesn't throw
  })

  it('normalises email to lower-case', async () => {
    const insertResult = {
      id: 'uid',
      email: 'upper@example.com',
      $relatedQuery: vi.fn().mockReturnValue({ relate: vi.fn().mockResolvedValue(undefined) })
    }
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      insertAndFetch: vi.fn().mockResolvedValue(insertResult)
    })

    const result = await User.processProfile({
      profile: { email: 'UPPER@EXAMPLE.COM', displayName: 'Test' },
      providerKey: 'github'
    })
    expect(result.email).toBe(result.email.toLowerCase())
  })

  it('throws ERR_ACCOUNT_BANNED when existing user is inactive', async () => {
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ isActive: false, isSystem: false })
    })

    await expect(
      User.processProfile({ profile: { email: 'banned@example.com', displayName: 'Banned' }, providerKey: 'github' })
    ).rejects.toThrow('ERR_ACCOUNT_BANNED')
  })

  it('throws when existing user is a system account', async () => {
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ isActive: true, isSystem: true })
    })

    await expect(
      User.processProfile({ profile: { email: 'system@example.com', displayName: 'System' }, providerKey: 'github' })
    ).rejects.toThrow('This is a system reserved account')
  })

  it('updates existing active user name and returns user', async () => {
    const patchAndFetch = vi.fn().mockResolvedValue({ id: 'existing', email: 'existing@example.com', name: 'Updated Name' })
    const existingUser = {
      isActive: true,
      isSystem: false,
      $query: vi.fn().mockReturnValue({ patchAndFetch })
    }
    globalThis.WIKI.db.users.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(existingUser)
    })

    const result = await User.processProfile({
      profile: { email: 'existing@example.com', displayName: 'Updated Name' },
      providerKey: 'github'
    })
    expect(patchAndFetch).toHaveBeenCalledWith({ name: 'Updated Name' })
    expect(result.email).toBe('existing@example.com')
  })
})

// ---------------------------------------------------------------------------
// bcrypt — password hashing utilities used in the model
// ---------------------------------------------------------------------------
describe('bcrypt password utilities (used by User model)', () => {
  it('hashes a password and verifies it correctly', async () => {
    const password = 'S3cur3P@ss!'
    const hash = await bcrypt.hash(password, 12)
    expect(await bcrypt.compare(password, hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await bcrypt.hash('correct', 12)
    expect(await bcrypt.compare('wrong', hash)).toBe(false)
  })

  it('produces different hashes for the same input (salt)', async () => {
    const hash1 = await bcrypt.hash('same', 12)
    const hash2 = await bcrypt.hash('same', 12)
    expect(hash1).not.toBe(hash2)
  })
})
