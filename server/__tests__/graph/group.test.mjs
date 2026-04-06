import { describe, it, expect, vi, beforeEach } from 'vitest'
import resolvers from '../../graph/resolvers/group.mjs'

const { Query, Mutation, Group } = resolvers

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext (overrides = {}) {
  return {
    req: {
      user: { id: 42, groups: [] },
      isAuthenticated: true,
      ...overrides.req
    },
    ...overrides
  }
}

function makeGroupsQueryChain (finalValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    patch: vi.fn().mockReturnThis(),
    deleteById: vi.fn().mockReturnThis(),
    insertAndFetch: vi.fn().mockResolvedValue(finalValue),
    relatedQuery: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    as: vi.fn().mockReturnThis(),
    then (resolve, reject) {
      return Promise.resolve(finalValue).then(resolve, reject)
    }
  }
  return chain
}

// ---------------------------------------------------------------------------
// Query: groups
// ---------------------------------------------------------------------------

describe('Query.groups', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_FORBIDDEN when user has no access and no managed groups', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const ctx = makeContext({ req: { user: { id: 1, groups: [] } } })
    WIKI.db.groups = { query: vi.fn().mockReturnValue(makeGroupsQueryChain([])) }

    await expect(Query.groups({}, {}, ctx)).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns all groups when user has full access', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const fakeGroups = [{ id: 'g-1', name: 'Admins' }, { id: 'g-2', name: 'Users' }]
    const chain = makeGroupsQueryChain(fakeGroups)
    const relatedChain = { count: vi.fn().mockReturnThis(), as: vi.fn().mockReturnThis() }
    chain.relatedQuery = vi.fn().mockReturnValue(relatedChain)
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue(chain),
      relatedQuery: vi.fn().mockReturnValue(relatedChain)
    }

    const result = await Query.groups({}, {}, makeContext())
    expect(result).toEqual(fakeGroups)
  })

  it('returns only managed groups when user lacks full access but has managed groups', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const userGroups = [{ id: 'ug-1', managedGroups: ['mg-1', 'mg-2'] }]
    const fakeGroups = [{ id: 'mg-1', name: 'Managed Group' }]

    let callCount = 0
    const chain = makeGroupsQueryChain(fakeGroups)
    chain.relatedQuery = vi.fn().mockReturnValue({ count: vi.fn().mockReturnThis(), as: vi.fn().mockReturnThis() })

    WIKI.db.groups = {
      query: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            whereIn: vi.fn().mockResolvedValue(userGroups)
          }
        }
        return chain
      }),
      relatedQuery: vi.fn().mockReturnValue({ count: vi.fn().mockReturnThis(), as: vi.fn().mockReturnThis() })
    }

    const ctx = makeContext({ req: { user: { id: 99, groups: [{ id: 'ug-1' }] } } })
    const result = await Query.groups({}, {}, ctx)
    expect(result).toEqual(fakeGroups)
  })
})

// ---------------------------------------------------------------------------
// Query: groupById
// ---------------------------------------------------------------------------

describe('Query.groupById', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('returns group when user has full access', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const fakeGroup = { id: 'g-1', name: 'Admins', permissions: [], rules: [] }
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(fakeGroup) })
    }

    const result = await Query.groupById({}, { id: 'g-1' }, makeContext())
    expect(result.id).toBe('g-1')
  })

  it('throws ERR_FORBIDDEN when user lacks access and group not in managedGroups', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const userGroups = [{ id: 'ug-1', managedGroups: ['other-group'] }]
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ whereIn: vi.fn().mockResolvedValue(userGroups) })
    }

    const ctx = makeContext({ req: { user: { id: 99, groups: [{ id: 'ug-1' }] } } })
    await expect(Query.groupById({}, { id: 'target-group' }, ctx)).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns group when group is in managedGroups', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const userGroups = [{ id: 'ug-1', managedGroups: ['g-target'] }]
    const fakeGroup = { id: 'g-target', name: 'Target Group' }

    let callCount = 0
    WIKI.db.groups = {
      query: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return { whereIn: vi.fn().mockResolvedValue(userGroups) }
        }
        return { findById: vi.fn().mockResolvedValue(fakeGroup) }
      })
    }

    const ctx = makeContext({ req: { user: { id: 99, groups: [{ id: 'ug-1' }] } } })
    const result = await Query.groupById({}, { id: 'g-target' }, ctx)
    expect(result.id).toBe('g-target')
  })
})

// ---------------------------------------------------------------------------
// Mutation: createGroup
// ---------------------------------------------------------------------------

describe('Mutation.createGroup', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.reloadGroups = vi.fn().mockResolvedValue(undefined)
    WIKI.events = { outbound: { emit: vi.fn() } }
    WIKI.data = {
      groups: {
        defaultPermissions: ['read:pages'],
        defaultRules: [{ match: 'START', path: '/', allow: true }]
      }
    }
  })

  it('throws ERR_FORBIDDEN when user lacks manage:groups', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Mutation.createGroup({}, { name: 'New Group' }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('creates group and reloads groups on success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const newGroup = { id: 'new-g', name: 'New Group', isSystem: false }
    const chain = makeGroupsQueryChain(newGroup)
    WIKI.db.groups = { query: vi.fn().mockReturnValue(chain) }

    const result = await Mutation.createGroup({}, { name: 'New Group' }, makeContext())
    expect(result.operation.succeeded).toBe(true)
    expect(result.group.id).toBe('new-g')
    expect(WIKI.auth.reloadGroups).toHaveBeenCalledOnce()
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('reloadGroups')
  })
})

// ---------------------------------------------------------------------------
// Mutation: deleteGroup
// ---------------------------------------------------------------------------

describe('Mutation.deleteGroup', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.reloadGroups = vi.fn().mockResolvedValue(undefined)
    WIKI.auth.revokeUserTokens = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
    WIKI.data = { systemIds: { guestsGroupId: 'guests-id', usersGroupId: 'users-id' } }
    WIKI.config = { auth: { rootAdminGroupId: 'admin-id' } }
  })

  it('throws ERR_FORBIDDEN when user lacks permission', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Mutation.deleteGroup({}, { id: 'some-id' }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('prevents deleting the guests system group', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    await expect(Mutation.deleteGroup({}, { id: 'guests-id' }, makeContext())).rejects.toThrow('Cannot delete this group.')
  })

  it('prevents deleting the users system group', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    await expect(Mutation.deleteGroup({}, { id: 'users-id' }, makeContext())).rejects.toThrow('Cannot delete this group.')
  })

  it('prevents deleting the root admin group', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    await expect(Mutation.deleteGroup({}, { id: 'admin-id' }, makeContext())).rejects.toThrow('Cannot delete this group.')
  })

  it('deletes group, revokes tokens and reloads on success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const chain = { deleteById: vi.fn().mockResolvedValue(1) }
    WIKI.db.groups = { query: vi.fn().mockReturnValue(chain) }

    const result = await Mutation.deleteGroup({}, { id: 'custom-g' }, makeContext())
    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 'custom-g', kind: 'g' })
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: 'custom-g', kind: 'g' })
    expect(WIKI.auth.reloadGroups).toHaveBeenCalledOnce()
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: updateGroup
// ---------------------------------------------------------------------------

describe('Mutation.updateGroup', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.checkExclusiveAccess = vi.fn().mockReturnValue(false)
    WIKI.auth.reloadGroups = vi.fn().mockResolvedValue(undefined)
    WIKI.auth.revokeUserTokens = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
  })

  it('throws ERR_FORBIDDEN when user lacks manage:groups', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    await expect(Mutation.updateGroup({}, { id: 'g-1', name: 'Updated', permissions: [], pageRules: [] }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('throws when pageRules contain unsafe regex', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    await expect(
      Mutation.updateGroup({}, {
        id: 'g-1',
        name: 'Test',
        permissions: [],
        pageRules: [{ match: 'REGEX', path: '(a+)+(b+)+' }],
        redirectOnLogin: '/'
      }, makeContext())
    ).rejects.toThrow('unsafe or exponential time regex')
  })

  it('defaults redirectOnLogin to "/" when empty', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const patchMock = vi.fn().mockReturnThis()
    const whereMock = vi.fn().mockResolvedValue(1)
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ patch: patchMock, where: whereMock })
    }

    await Mutation.updateGroup({}, {
      id: 'g-1', name: 'Test', permissions: [], pageRules: [], redirectOnLogin: ''
    }, makeContext())

    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({ redirectOnLogin: '/' }))
  })

  it('updates group and reloads on success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const patchMock = vi.fn().mockReturnThis()
    const whereMock = vi.fn().mockResolvedValue(1)
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ patch: patchMock, where: whereMock })
    }

    const result = await Mutation.updateGroup({}, {
      id: 'g-1',
      name: 'Updated',
      permissions: ['read:pages'],
      pageRules: [],
      redirectOnLogin: '/home'
    }, makeContext())

    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 'g-1', kind: 'g' })
    expect(WIKI.auth.reloadGroups).toHaveBeenCalledOnce()
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: assignUserToGroup
// ---------------------------------------------------------------------------

describe('Mutation.assignUserToGroup', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.checkExclusiveAccess = vi.fn().mockReturnValue(false)
    WIKI.auth.revokeUserTokens = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
    WIKI.config = { auth: { guestUserId: 'guest-usr' } }
  })

  it('throws ERR_FORBIDDEN when user lacks manage:groups and has no managed access', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const ctx = makeContext({ req: { user: { id: 1, groups: [] } } })
    WIKI.db.groups = { query: vi.fn().mockReturnValue({ whereIn: vi.fn().mockResolvedValue([]) }) }

    await expect(Mutation.assignUserToGroup({}, { userId: 10, groupId: 'g-1' }, ctx)).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('prevents assigning guest user', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    await expect(Mutation.assignUserToGroup({}, { userId: 'guest-usr', groupId: 'g-1' }, makeContext()))
      .rejects.toThrow('Cannot assign the Guest user')
  })

  it('throws when groupId is invalid', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }
    await expect(Mutation.assignUserToGroup({}, { userId: 10, groupId: 'nonexistent' }, makeContext()))
      .rejects.toThrow('Invalid Group ID')
  })

  it('throws when userId is invalid', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const grp = { id: 'g-1', permissions: [] }
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(grp) })
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }
    await expect(Mutation.assignUserToGroup({}, { userId: 999, groupId: 'g-1' }, makeContext()))
      .rejects.toThrow('Invalid User ID')
  })

  it('throws when user is already in group', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const grp = { id: 'g-1', permissions: [] }
    const usr = { id: 10 }
    const relExist = { userId: 10, groupId: 'g-1' }

    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(grp) })
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(usr) })
    }
    WIKI.db.knex = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(relExist)
    })

    await expect(Mutation.assignUserToGroup({}, { userId: 10, groupId: 'g-1' }, makeContext()))
      .rejects.toThrow('already assigned')
  })

  it('assigns user to group and revokes tokens on success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const grp = {
      id: 'g-1',
      permissions: [],
      $relatedQuery: vi.fn().mockReturnValue({ relate: vi.fn().mockResolvedValue(1) })
    }
    const usr = { id: 10 }

    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(grp) })
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(usr) })
    }
    WIKI.db.knex = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null)
    })

    const result = await Mutation.assignUserToGroup({}, { userId: 10, groupId: 'g-1' }, makeContext())
    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 10, kind: 'u' })
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: 10, kind: 'u' })
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: unassignUserFromGroup
// ---------------------------------------------------------------------------

describe('Mutation.unassignUserFromGroup', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.auth.revokeUserTokens = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
    WIKI.config = { auth: { guestUserId: 'guest-usr' } }
    WIKI.data = { systemIds: { guestsGroupId: 'guests-g' } }
  })

  it('throws ERR_FORBIDDEN when user lacks manage:groups and has no managed access', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const ctx = makeContext({ req: { user: { id: 1, groups: [] } } })
    WIKI.db.groups = { query: vi.fn().mockReturnValue({ whereIn: vi.fn().mockResolvedValue([]) }) }

    await expect(Mutation.unassignUserFromGroup({}, { userId: 10, groupId: 'g-1' }, ctx)).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('prevents unassigning userId === 2 (legacy guest guard)', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    await expect(Mutation.unassignUserFromGroup({}, { userId: 2, groupId: 'g-1' }, makeContext()))
      .rejects.toThrow('Cannot unassign Guest user')
  })

  it('throws when groupId is invalid', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }
    await expect(Mutation.unassignUserFromGroup({}, { userId: 10, groupId: 'bad-g' }, makeContext()))
      .rejects.toThrow('Invalid Group ID')
  })

  it('unassigns user and revokes tokens on success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    const grp = {
      id: 'g-1',
      $relatedQuery: vi.fn().mockReturnValue({
        unrelate: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(1)
      })
    }
    const usr = { id: 10 }

    WIKI.db.groups = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(grp) })
    }
    WIKI.db.users = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(usr) })
    }

    const result = await Mutation.unassignUserFromGroup({}, { userId: 10, groupId: 'g-1' }, makeContext())
    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 10, kind: 'u' })
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Group type resolver
// ---------------------------------------------------------------------------

describe('Group type resolver', () => {
  it('Group.users calls $relatedQuery("users")', () => {
    const fakeMock = vi.fn().mockReturnValue([{ id: 1 }])
    const grp = { $relatedQuery: fakeMock }
    const result = Group.users(grp)
    expect(fakeMock).toHaveBeenCalledWith('users')
    expect(result).toEqual([{ id: 1 }])
  })
})
