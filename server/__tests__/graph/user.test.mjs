import { describe, it, expect, vi, beforeEach } from 'vitest'
import resolvers from '../../graph/resolvers/user.mjs'

const { Query, Mutation } = resolvers

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

/**
 * Build a chainable Objection-style query mock.
 * finalValue is what await on the chain resolves to.
 */
function makeObjQuery (finalValue) {
  const chain = {
    count: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    patch: vi.fn().mockReturnThis(),
    whereNotNull: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(finalValue),
    then (resolve, reject) {
      return Promise.resolve(finalValue).then(resolve, reject)
    }
  }
  return chain
}

// ---------------------------------------------------------------------------
// Query: users (list)
// ---------------------------------------------------------------------------

describe('Query.users', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.users({}, {}, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns users array and total when access granted', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)

    const fakeUsers = [
      { id: 1, email: 'a@test.com', name: 'Alice', isSystem: false, isActive: true, createdAt: new Date(), lastLoginAt: new Date() }
    ]

    // users.query() is called twice — once for count, once for list.
    // We track the call count to return different values.
    let callCount = 0
    WIKI.db.users = {
      query: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          // count call
          return makeObjQuery({ count: '1' })
        }
        // list call
        const chain = makeObjQuery(fakeUsers)
        chain.then = (resolve, reject) => Promise.resolve(fakeUsers).then(resolve, reject)
        return chain
      })
    }

    const result = await Query.users({}, { pageSize: 10, page: 1 }, makeContext())
    expect(result.users).toEqual(fakeUsers)
    expect(result.total).toBe('1')
  })

  it('clamps invalid pageSize to 1000', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)

    const listChain = makeObjQuery([])
    const countChain = makeObjQuery({ count: '0' })

    let callCount = 0
    WIKI.db.users = {
      query: vi.fn(() => {
        callCount++
        return callCount === 1 ? countChain : listChain
      })
    }

    await Query.users({}, { pageSize: 9999, page: 1 }, makeContext())
    // Limit mock should have been called with 1000
    expect(listChain.limit).toHaveBeenCalledWith(1000)
  })

  it('clamps invalid offset (page < 1) to 1', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)

    const listChain = makeObjQuery([])
    const countChain = makeObjQuery({ count: '0' })
    let callCount = 0
    WIKI.db.users = {
      query: vi.fn(() => {
        callCount++
        return callCount === 1 ? countChain : listChain
      })
    }

    await Query.users({}, { pageSize: 10, page: -5 }, makeContext())
    // offset should be (1-1)*10 = 0
    expect(listChain.offset).toHaveBeenCalledWith(0)
  })
})

// ---------------------------------------------------------------------------
// Query: userById
// ---------------------------------------------------------------------------

describe('Query.userById', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when not self and no permission', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const context = makeContext({ req: { user: { id: 99 }, isAuthenticated: true } })
    await expect(Query.userById({}, { id: 1 }, context)).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('allows self-lookup without permission check', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false) // would deny if checked
    const mockUser = {
      id: 42,
      email: 'me@test.com',
      name: 'Me',
      auth: {},
      passkeys: { authenticators: [] }
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(mockUser)
      })
    }
    const context = makeContext({ req: { user: { id: 42 }, isAuthenticated: true } })
    const result = await Query.userById({}, { id: 42 }, context)
    expect(result.id).toBe(42)
    // auth.checkAccess should NOT have been called (self path)
    expect(WIKI.auth.checkAccess).not.toHaveBeenCalled()
  })

  it('throws ERR_INVALID_USER when user not found', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(null)
      })
    }
    await expect(Query.userById({}, { id: 999 }, makeContext())).rejects.toThrow('ERR_INVALID_USER')
  })

  it('redacts password and tfaSecret in auth field', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const mockUser = {
      id: 1,
      auth: {
        'strat-local': { password: 'bcrypt-hash', tfaSecret: 'totp-secret', mustChangePwd: false }
      },
      passkeys: { authenticators: [] }
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(mockUser)
      })
    }
    const result = await Query.userById({}, { id: 1 }, makeContext())
    expect(result.auth['strat-local'].password).toBe('redacted')
    expect(result.auth['strat-local'].tfaSecret).toBe('redacted')
  })

  it('maps passkeys.authenticators to simplified objects', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const mockUser = {
      id: 1,
      auth: {},
      passkeys: {
        authenticators: [
          { id: 'pk-1', createdAt: new Date().toISOString(), name: 'My Key', rpID: 'wiki.example.com' }
        ]
      }
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(mockUser)
      })
    }
    const result = await Query.userById({}, { id: 1 }, makeContext())
    expect(result.passkeys).toHaveLength(1)
    expect(result.passkeys[0]).toMatchObject({
      id: 'pk-1',
      name: 'My Key',
      siteHostname: 'wiki.example.com'
    })
  })

  it('returns empty passkeys array when no authenticators', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const mockUser = { id: 1, auth: {}, passkeys: {} }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(mockUser)
      })
    }
    const result = await Query.userById({}, { id: 1 }, makeContext())
    expect(result.passkeys).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Query: userDefaults
// ---------------------------------------------------------------------------

describe('Query.userDefaults', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.userDefaults({}, {}, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns WIKI.config.userDefaults when access granted', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.config.userDefaults = { timezone: 'UTC', dateFormat: 'YYYY-MM-DD', timeFormat: '24h' }
    const result = await Query.userDefaults({}, {}, makeContext())
    expect(result).toEqual({ timezone: 'UTC', dateFormat: 'YYYY-MM-DD', timeFormat: '24h' })
  })
})

// ---------------------------------------------------------------------------
// Query: lastLogins
// ---------------------------------------------------------------------------

describe('Query.lastLogins', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.lastLogins({}, {}, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns list of recent logins when access granted', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const loginRows = [
      { id: 1, name: 'Alice', lastLoginAt: new Date() }
    ]
    const chain = {
      select: vi.fn().mockReturnThis(),
      whereNotNull: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(loginRows)
    }
    WIKI.db.users = { query: vi.fn().mockReturnValue(chain) }
    const result = await Query.lastLogins({}, {}, makeContext())
    expect(result).toEqual(loginRows)
  })
})

// ---------------------------------------------------------------------------
// Query: userPermissionsAtPath
// ---------------------------------------------------------------------------

describe('Query.userPermissionsAtPath', () => {
  it('returns empty array (stub)', async () => {
    const result = await Query.userPermissionsAtPath({}, { path: '/some/page' }, makeContext())
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Mutation: createUser
// ---------------------------------------------------------------------------

describe('Mutation.createUser', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('returns error when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.createUser({}, { email: 'new@test.com', name: 'Test' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('calls createNewUser with isVerified: true and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const createMock = vi.fn().mockResolvedValue({ id: 'new-id' })
    WIKI.db.users = { createNewUser: createMock }

    const args = { email: 'new@test.com', name: 'New User', password: 'secret' }
    const result = await Mutation.createUser({}, args, makeContext())

    expect(createMock).toHaveBeenCalledWith({ ...args, isVerified: true })
    expect(result.operation.succeeded).toBe(true)
  })

  it('returns error when createNewUser throws', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.users = { createNewUser: vi.fn().mockRejectedValue(new Error('ERR_EMAIL_TAKEN')) }

    const result = await Mutation.createUser({}, { email: 'used@test.com', name: 'X' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_EMAIL_TAKEN/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: deleteUser
// ---------------------------------------------------------------------------

describe('Mutation.deleteUser', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.guest = { id: 1 }
    WIKI.auth.revokeUserTokens = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
    WIKI.Error = {
      UserDeleteProtected: class extends Error {
        constructor () { super('ERR_USER_DELETE_PROTECTED') }
      }
    }
  })

  it('returns error when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.deleteUser({}, { id: 5 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('protects guest user from deletion', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const result = await Mutation.deleteUser({}, { id: 1 }, makeContext()) // id === guest.id
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_USER_DELETE_PROTECTED/)
  })

  it('deletes user, revokes tokens and emits event', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const deleteMock = vi.fn().mockResolvedValue(undefined)
    WIKI.db.users = { deleteUser: deleteMock }

    const result = await Mutation.deleteUser({}, { id: 5, replaceId: null }, makeContext())
    expect(deleteMock).toHaveBeenCalledWith(5, null)
    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 5, kind: 'u' })
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: 5, kind: 'u' })
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: updateUser
// ---------------------------------------------------------------------------

describe('Mutation.updateUser', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('returns error when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.updateUser({}, { id: 5, patch: { name: 'New Name' } }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('calls updateUser and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const updateMock = vi.fn().mockResolvedValue(undefined)
    WIKI.db.users = { updateUser: updateMock }

    const result = await Mutation.updateUser({}, { id: 5, patch: { name: 'Updated' } }, makeContext())
    expect(updateMock).toHaveBeenCalledWith(5, { name: 'Updated' })
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: verifyUser
// ---------------------------------------------------------------------------

describe('Mutation.verifyUser', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
  })

  it('patches isVerified to true and returns success', async () => {
    const patchMock = vi.fn().mockResolvedValue(1)
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        patch: vi.fn().mockReturnValue({
          findById: patchMock
        })
      })
    }
    const result = await Mutation.verifyUser({}, { id: 5 }, makeContext())
    expect(patchMock).toHaveBeenCalledWith(5)
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: activateUser / deactivateUser
// ---------------------------------------------------------------------------

describe('Mutation.activateUser', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
  })

  it('patches isActive to true and returns success', async () => {
    const findByIdMock = vi.fn().mockResolvedValue(1)
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        patch: vi.fn().mockReturnValue({ findById: findByIdMock })
      })
    }
    const result = await Mutation.activateUser({}, { id: 5 }, makeContext())
    expect(result.operation.succeeded).toBe(true)
  })
})

describe('Mutation.deactivateUser', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
    WIKI.auth.revokeUserTokens = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
  })

  it('returns error when trying to deactivate system accounts (id <= 2)', async () => {
    const result = await Mutation.deactivateUser({}, { id: 1 }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/system accounts/)
  })

  it('deactivates user and revokes tokens', async () => {
    const findByIdMock = vi.fn().mockResolvedValue(1)
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        patch: vi.fn().mockReturnValue({ findById: findByIdMock })
      })
    }
    const result = await Mutation.deactivateUser({}, { id: 5 }, makeContext())
    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 5, kind: 'u' })
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: changeUserPassword — validation
// ---------------------------------------------------------------------------

describe('Mutation.changeUserPassword', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
  })

  it('returns ERR_PASSWORD_TOO_SHORT when newPassword < 8 chars', async () => {
    const result = await Mutation.changeUserPassword({}, { id: 5, newPassword: 'short' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_PASSWORD_TOO_SHORT/)
  })

  it('returns ERR_INVALID_USER when user not found', async () => {
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(null)
      })
    }
    const result = await Mutation.changeUserPassword({}, { id: 999, newPassword: 'newpassword' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_USER/)
  })

  it('hashes new password and patches the user', async () => {
    const usr = {
      auth: { 'local-strat': { password: 'old-hash', mustChangePwd: false } }
    }
    const patchMock = vi.fn().mockResolvedValue(1)
    WIKI.db.users = {
      query: vi.fn()
        .mockReturnValueOnce({ findById: vi.fn().mockResolvedValue(usr) })
        .mockReturnValueOnce({ patch: vi.fn().mockReturnValue({ findById: patchMock }) })
    }
    WIKI.db.authentication = {
      getStrategy: vi.fn().mockResolvedValue({ id: 'local-strat' })
    }

    const result = await Mutation.changeUserPassword(
      {},
      { id: 5, newPassword: 'newsecretpass', mustChangePassword: false },
      makeContext()
    )
    expect(patchMock).toHaveBeenCalledWith(5)
    expect(result.operation.succeeded).toBe(true)
    // Confirm password was replaced (bcrypt hash starts with $2)
    expect(usr.auth['local-strat'].password).toMatch(/^\$2/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: updateProfile
// ---------------------------------------------------------------------------

describe('Mutation.updateProfile', () => {
  beforeEach(() => {
    WIKI.auth.guest = { id: 0 }
  })

  it('throws ERR_NOT_AUTHENTICATED when no user', async () => {
    const result = await Mutation.updateProfile(
      {},
      { name: 'Test' },
      makeContext({ req: { user: null } })
    )
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_NOT_AUTHENTICATED/)
  })

  it('throws ERR_NOT_AUTHENTICATED when user is guest', async () => {
    WIKI.auth.guest = { id: 5 }
    const result = await Mutation.updateProfile(
      {},
      { name: 'Test' },
      makeContext({ req: { user: { id: 5 } } })
    )
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_NOT_AUTHENTICATED/)
  })

  it('returns ERR_INACTIVE_USER when user is not active', async () => {
    const usr = { id: 42, isActive: false, isVerified: true, meta: {}, prefs: {} }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(usr)
      })
    }
    const result = await Mutation.updateProfile({}, { name: 'Test' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INACTIVE_USER/)
  })

  it('returns ERR_USER_NOT_VERIFIED when user is not verified', async () => {
    const usr = { id: 42, isActive: true, isVerified: false, meta: {}, prefs: {} }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(usr)
      })
    }
    const result = await Mutation.updateProfile({}, { name: 'Test' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_USER_NOT_VERIFIED/)
  })

  it('rejects invalid dateFormat values', async () => {
    const usr = { id: 42, isActive: true, isVerified: true, meta: {}, prefs: {} }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(usr)
      })
    }
    const result = await Mutation.updateProfile({}, { name: 'Test', dateFormat: 'invalid-format' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_INPUT/)
  })

  it('rejects invalid appearance values', async () => {
    const usr = { id: 42, isActive: true, isVerified: true, meta: {}, prefs: {} }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue(usr)
      })
    }
    const result = await Mutation.updateProfile({}, { name: 'Test', appearance: 'pink' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_INPUT/)
  })

  it('updates profile with valid data and returns success', async () => {
    const usr = {
      id: 42, isActive: true, isVerified: true,
      name: 'Old Name',
      meta: { location: '', jobTitle: '', pronouns: '' },
      prefs: { timezone: 'UTC', dateFormat: '', timeFormat: '24h', appearance: 'site', cvd: 'none' }
    }
    const patchMock = vi.fn().mockResolvedValue(1)
    WIKI.db.users = {
      query: vi.fn()
        .mockReturnValueOnce({ findById: vi.fn().mockResolvedValue(usr) })
        .mockReturnValueOnce({ findById: vi.fn().mockReturnValue({ patch: patchMock }) })
    }
    const result = await Mutation.updateProfile(
      {},
      { name: 'New Name', timezone: 'America/Sao_Paulo', dateFormat: 'DD/MM/YYYY', timeFormat: '12h', appearance: 'dark', cvd: 'none' },
      makeContext()
    )
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: updateUserDefaults
// ---------------------------------------------------------------------------

describe('Mutation.updateUserDefaults', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.configSvc = { saveToDb: vi.fn().mockResolvedValue(undefined) }
  })

  it('returns error when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.updateUserDefaults({}, { timezone: 'UTC', dateFormat: '', timeFormat: '24h' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('saves userDefaults and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const args = { timezone: 'America/New_York', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' }
    const result = await Mutation.updateUserDefaults({}, args, makeContext())
    expect(WIKI.config.userDefaults).toEqual(args)
    expect(WIKI.configSvc.saveToDb).toHaveBeenCalledWith(['userDefaults'])
    expect(result.operation.succeeded).toBe(true)
  })
})
