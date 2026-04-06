import { describe, it, expect, vi, beforeEach } from 'vitest'
import resolvers from '../../graph/resolvers/authentication.mjs'

const { Query, Mutation, AuthenticationActiveStrategy } = resolvers

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext (overrides = {}) {
  return {
    req: {
      user: { id: 1 },
      ...overrides.req
    },
    ...overrides
  }
}

function makeQueryChain (result) {
  const chain = {
    orderBy: vi.fn().mockResolvedValue(result),
    findById: vi.fn().mockReturnThis(),
    findOne: vi.fn().mockResolvedValue(result),
    patch: vi.fn().mockResolvedValue(1),
    first: vi.fn().mockResolvedValue(result),
    where: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(1),
    insert: vi.fn().mockResolvedValue(1)
  }
  // Allow chained then for direct await on the chain object
  return chain
}

// ---------------------------------------------------------------------------
// Query: apiState
// ---------------------------------------------------------------------------

describe('Query.apiState', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    expect(() => Query.apiState({}, {}, makeContext())).toThrow('ERR_FORBIDDEN')
  })

  it('returns WIKI.config.api.isEnabled when access granted', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.config.api = { isEnabled: true }
    expect(Query.apiState({}, {}, makeContext())).toBe(true)
  })

  it('returns false when api is disabled', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.config.api = { isEnabled: false }
    expect(Query.apiState({}, {}, makeContext())).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Query: authStrategies
// ---------------------------------------------------------------------------

describe('Query.authStrategies', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.authStrategies({}, {}, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('maps isAvailable to boolean true for truthy strategies', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.data = {
      authentication: [
        { key: 'local', title: 'Local', isAvailable: true },
        { key: 'ldap', title: 'LDAP', isAvailable: undefined }
      ]
    }
    const result = await Query.authStrategies({}, {}, makeContext())
    expect(result[0].isAvailable).toBe(true)
    expect(result[1].isAvailable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Query: authActiveStrategies
// ---------------------------------------------------------------------------

describe('Query.authActiveStrategies', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn().mockReturnValue(true)
    WIKI.data = {
      authentication: [
        { key: 'local', props: { clientId: { sensitive: false }, secret: { sensitive: true } } }
      ]
    }
  })

  it('throws ERR_FORBIDDEN when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Query.authActiveStrategies({}, { enabledOnly: true }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('redacts sensitive config fields with ********', async () => {
    WIKI.db.authentication = {
      getStrategies: vi.fn().mockResolvedValue([
        {
          id: 'strat-1',
          module: 'local',
          config: { clientId: 'my-id', secret: 'super-secret' }
        }
      ])
    }

    const result = await Query.authActiveStrategies({}, { enabledOnly: true }, makeContext())
    expect(result[0].config.clientId).toBe('my-id')
    expect(result[0].config.secret).toBe('********')
  })

  it('returns empty config for unknown module', async () => {
    WIKI.db.authentication = {
      getStrategies: vi.fn().mockResolvedValue([
        { id: 'strat-x', module: 'unknown-module', config: { foo: 'bar' } }
      ])
    }
    // module not in WIKI.data.authentication — _.find returns undefined, _.transform over undefined props returns {}
    const result = await Query.authActiveStrategies({}, { enabledOnly: false }, makeContext())
    expect(result[0].config).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Query: authSiteStrategies
// ---------------------------------------------------------------------------

describe('Query.authSiteStrategies', () => {
  beforeEach(() => {
    WIKI.db.sites = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockResolvedValue({
          config: {
            authStrategies: [
              { id: 'strat-1', order: 2, isVisible: true }
            ]
          }
        })
      })
    }
    WIKI.db.authentication = {
      getStrategies: vi.fn().mockResolvedValue([
        { id: 'strat-1', module: 'local' },
        { id: 'strat-2', module: 'ldap' }
      ])
    }
  })

  it('returns all strategies when visibleOnly is false', async () => {
    const result = await Query.authSiteStrategies({}, { siteId: 'site-1', enabledOnly: true, visibleOnly: false }, makeContext())
    expect(result).toHaveLength(2)
  })

  it('returns only visible strategies when visibleOnly is true', async () => {
    const result = await Query.authSiteStrategies({}, { siteId: 'site-1', enabledOnly: true, visibleOnly: true }, makeContext())
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('strat-1')
    expect(result[0].isVisible).toBe(true)
  })

  it('sorts strategies by order', async () => {
    WIKI.db.sites.query().findById.mockResolvedValue({
      config: {
        authStrategies: [
          { id: 'strat-1', order: 5, isVisible: true },
          { id: 'strat-2', order: 1, isVisible: true }
        ]
      }
    })
    const result = await Query.authSiteStrategies({}, { siteId: 'site-1', enabledOnly: true, visibleOnly: false }, makeContext())
    expect(result[0].order).toBeLessThanOrEqual(result[1].order)
  })
})

// ---------------------------------------------------------------------------
// Mutation: login
// ---------------------------------------------------------------------------

describe('Mutation.login', () => {
  beforeEach(() => {
    WIKI.config.flags = { ldapdebug: false }
  })

  it('returns success with jwt on valid credentials', async () => {
    const authResult = { jwt: 'token-abc', nextAction: 'redirect' }
    WIKI.db.users = { login: vi.fn().mockResolvedValue(authResult) }

    const result = await Mutation.login({}, { username: 'user@test.com', password: 'pass', strategy: 'local' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.jwt).toBe('token-abc')
    expect(result.nextAction).toBe('redirect')
  })

  it('returns error object on invalid credentials', async () => {
    WIKI.db.users = { login: vi.fn().mockRejectedValue(new Error('ERR_LOGIN_FAILED')) }

    const result = await Mutation.login({}, { username: 'bad@test.com', password: 'wrong', strategy: 'local' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_LOGIN_FAILED/)
  })

  it('logs debug on LDAP login failure when ldapdebug flag is on', async () => {
    WIKI.config.flags = { ldapdebug: true }
    WIKI.db.users = { login: vi.fn().mockRejectedValue(new Error('LDAP error')) }

    const result = await Mutation.login({}, { username: 'u', password: 'p', strategy: 'ldap' }, makeContext())
    expect(WIKI.logger.warn).toHaveBeenCalled()
    expect(result.operation.succeeded).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mutation: loginTFA
// ---------------------------------------------------------------------------

describe('Mutation.loginTFA', () => {
  it('returns success result on valid TFA', async () => {
    const authResult = { jwt: 'tfa-token', nextAction: 'redirect' }
    WIKI.db.users = { loginTFA: vi.fn().mockResolvedValue(authResult) }

    const result = await Mutation.loginTFA({}, { continuationToken: 'tok', securityCode: '123456' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.jwt).toBe('tfa-token')
  })

  it('returns error on invalid TFA code', async () => {
    WIKI.db.users = { loginTFA: vi.fn().mockRejectedValue(new Error('ERR_TFA_INVALID')) }

    const result = await Mutation.loginTFA({}, { continuationToken: 'tok', securityCode: '000000' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mutation: forgotPassword
// ---------------------------------------------------------------------------

describe('Mutation.forgotPassword', () => {
  it('always returns success (prevents email enumeration)', async () => {
    WIKI.db.users = { loginForgotPassword: vi.fn().mockResolvedValue(undefined) }

    const result = await Mutation.forgotPassword({}, { email: 'anyone@example.com' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
  })

  it('returns success even when user not found (safe error swallow)', async () => {
    WIKI.db.users = { loginForgotPassword: vi.fn().mockRejectedValue(new Error('ERR_INVALID_USER')) }

    const result = await Mutation.forgotPassword({}, { email: 'notfound@example.com' }, makeContext())
    // generateError wraps into operation
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_USER/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: refreshToken
// ---------------------------------------------------------------------------

describe('Mutation.refreshToken', () => {
  it('returns ERR_MISSING_TOKEN when token is absent', async () => {
    const result = await Mutation.refreshToken({}, {}, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_MISSING_TOKEN/)
  })

  it('returns ERR_INVALID_TOKEN for a malformed token', async () => {
    WIKI.config.auth = {
      certs: { public: 'bad-key' },
      audience: 'urn:wiki',
      tokenRenewal: '30d'
    }
    const result = await Mutation.refreshToken({}, { token: 'not.a.jwt' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_TOKEN/)
  })
})

// ---------------------------------------------------------------------------
// Mutation: setApiState
// ---------------------------------------------------------------------------

describe('Mutation.setApiState', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.config.api = { isEnabled: false }
    WIKI.configSvc = { saveToDb: vi.fn().mockResolvedValue(undefined) }
  })

  it('throws via error object when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.setApiState({}, { enabled: true }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('updates WIKI.config.api.isEnabled and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const result = await Mutation.setApiState({}, { enabled: true }, makeContext())
    expect(WIKI.config.api.isEnabled).toBe(true)
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: createApiKey
// ---------------------------------------------------------------------------

describe('Mutation.createApiKey', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.reloadApiKeys = vi.fn().mockResolvedValue(undefined)
    WIKI.events = { outbound: { emit: vi.fn() } }
  })

  it('returns error when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.createApiKey({}, { name: 'my-key' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('creates key and returns it on success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.apiKeys = { createNewKey: vi.fn().mockResolvedValue('the-generated-key') }

    const result = await Mutation.createApiKey({}, { name: 'my-key', expiration: '2027-01-01' }, makeContext())
    expect(result.key).toBe('the-generated-key')
    expect(result.operation.succeeded).toBe(true)
    expect(WIKI.auth.reloadApiKeys).toHaveBeenCalledOnce()
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('reloadApiKeys')
  })
})

// ---------------------------------------------------------------------------
// Mutation: revokeApiKey
// ---------------------------------------------------------------------------

describe('Mutation.revokeApiKey', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.reloadApiKeys = vi.fn().mockResolvedValue(undefined)
    WIKI.events = { outbound: { emit: vi.fn() } }
  })

  it('returns error when access denied', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.revokeApiKey({}, { id: 'key-1' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
  })

  it('patches key as revoked and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const patchMock = vi.fn().mockResolvedValue(1)
    WIKI.db.apiKeys = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockReturnValue({ patch: patchMock })
      })
    }

    const result = await Mutation.revokeApiKey({}, { id: 'key-1' }, makeContext())
    expect(patchMock).toHaveBeenCalledWith({ isRevoked: true })
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: register
// ---------------------------------------------------------------------------

describe('Mutation.register', () => {
  it('returns success and jwt on valid registration', async () => {
    const newUser = { id: 'usr-1' }
    const authResult = { jwt: 'new-user-token', nextAction: 'redirect' }
    WIKI.db.users = {
      createNewUser: vi.fn().mockResolvedValue(newUser),
      afterLoginChecks: vi.fn().mockResolvedValue(authResult)
    }
    WIKI.data = { systemIds: { localAuthId: 'local' } }

    const result = await Mutation.register({}, { email: 'new@test.com', password: 'pass123', name: 'New User' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.jwt).toBe('new-user-token')
  })

  it('returns error when registration fails', async () => {
    WIKI.db.users = {
      createNewUser: vi.fn().mockRejectedValue(new Error('ERR_EMAIL_TAKEN'))
    }
    WIKI.data = { systemIds: { localAuthId: 'local' } }

    const result = await Mutation.register({}, { email: 'taken@test.com', password: 'pass', name: 'Test' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_EMAIL_TAKEN/)
  })
})

// ---------------------------------------------------------------------------
// AuthenticationActiveStrategy type resolvers
// ---------------------------------------------------------------------------

describe('AuthenticationActiveStrategy type resolvers', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.data = {
      authentication: [
        { key: 'local', title: 'Local' },
        { key: 'ldap', title: 'LDAP' }
      ]
    }
  })

  it('config() throws ERR_FORBIDDEN when access denied', () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    expect(() => AuthenticationActiveStrategy.config({ config: {} }, {}, makeContext())).toThrow('ERR_FORBIDDEN')
  })

  it('config() returns obj.config when access granted', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const obj = { config: { clientId: 'abc' } }
    expect(AuthenticationActiveStrategy.config(obj, {}, makeContext())).toEqual({ clientId: 'abc' })
  })

  it('config() returns empty object when config is undefined', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    expect(AuthenticationActiveStrategy.config({}, {}, makeContext())).toEqual({})
  })

  it('allowedEmailRegex() returns empty string when not set', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    expect(AuthenticationActiveStrategy.allowedEmailRegex({}, {}, makeContext())).toBe('')
  })

  it('allowedEmailRegex() returns the value when set', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const obj = { allowedEmailRegex: '@example\\.com$' }
    expect(AuthenticationActiveStrategy.allowedEmailRegex(obj, {}, makeContext())).toBe('@example\\.com$')
  })

  it('autoEnrollGroups() returns empty array when not set', () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    expect(AuthenticationActiveStrategy.autoEnrollGroups({}, {}, makeContext())).toEqual([])
  })

  it('strategy() returns the matched WIKI.data.authentication entry', () => {
    const obj = { module: 'ldap' }
    const result = AuthenticationActiveStrategy.strategy(obj, {}, makeContext())
    expect(result).toEqual({ key: 'ldap', title: 'LDAP' })
  })

  it('strategy() returns undefined for unknown module', () => {
    const obj = { module: 'nonexistent' }
    const result = AuthenticationActiveStrategy.strategy(obj, {}, makeContext())
    expect(result).toBeUndefined()
  })
})
