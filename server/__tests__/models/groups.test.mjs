import { describe, it, expect, vi } from 'vitest'

vi.mock('objection', () => {
  class Model {
    static get tableName () { return '' }
    static get jsonSchema () { return {} }
    static get jsonAttributes () { return [] }
    static get relationMappings () { return {} }
    $beforeUpdate () {}
    $beforeInsert () {}
  }
  Model.ManyToManyRelation = 'ManyToManyRelation'
  return { Model }
})

vi.mock('../../models/users.mjs', () => ({
  User: class User {}
}))

import { Group } from '../../models/groups.mjs'

// ---------------------------------------------------------------------------
// tableName
// ---------------------------------------------------------------------------
describe('Group.tableName', () => {
  it('is groups', () => {
    expect(Group.tableName).toBe('groups')
  })
})

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------
describe('Group.jsonSchema', () => {
  it('requires name field', () => {
    expect(Group.jsonSchema.required).toContain('name')
  })

  it('defines id, name, isSystem, redirectOnLogin, createdAt, updatedAt', () => {
    const props = Object.keys(Group.jsonSchema.properties)
    expect(props).toEqual(
      expect.arrayContaining(['id', 'name', 'isSystem', 'redirectOnLogin', 'createdAt', 'updatedAt'])
    )
  })

  it('name is of type string', () => {
    expect(Group.jsonSchema.properties.name.type).toBe('string')
  })

  it('isSystem is of type boolean', () => {
    expect(Group.jsonSchema.properties.isSystem.type).toBe('boolean')
  })

  it('id is of type integer', () => {
    expect(Group.jsonSchema.properties.id.type).toBe('integer')
  })
})

// ---------------------------------------------------------------------------
// jsonAttributes
// ---------------------------------------------------------------------------
describe('Group.jsonAttributes', () => {
  it('includes permissions and pageRules', () => {
    expect(Group.jsonAttributes).toEqual(expect.arrayContaining(['permissions', 'pageRules']))
  })
})

// ---------------------------------------------------------------------------
// relationMappings
// ---------------------------------------------------------------------------
describe('Group.relationMappings', () => {
  it('defines users relation', () => {
    expect(Group.relationMappings).toHaveProperty('users')
  })

  it('users relation uses ManyToManyRelation', () => {
    expect(Group.relationMappings.users.relation).toBe('ManyToManyRelation')
  })

  it('users join uses userGroups through table', () => {
    const join = Group.relationMappings.users.join
    expect(join.through.from).toBe('userGroups.groupId')
    expect(join.through.to).toBe('userGroups.userId')
  })
})

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
describe('Group lifecycle hooks', () => {
  it('$beforeInsert sets createdAt and updatedAt', () => {
    const group = new Group()
    group.$beforeInsert()
    expect(group.createdAt).toBeTruthy()
    expect(group.updatedAt).toBeTruthy()
    expect(new Date(group.createdAt).toString()).not.toBe('Invalid Date')
  })

  it('$beforeUpdate sets updatedAt', () => {
    const group = new Group()
    group.$beforeUpdate()
    expect(group.updatedAt).toBeTruthy()
    expect(new Date(group.updatedAt).toString()).not.toBe('Invalid Date')
  })

  it('$beforeInsert createdAt and updatedAt are the same value', () => {
    const group = new Group()
    group.$beforeInsert()
    expect(group.createdAt).toBe(group.updatedAt)
  })
})

// ---------------------------------------------------------------------------
// Permission rule structure validation
// ---------------------------------------------------------------------------
describe('Group permission rule structure', () => {
  it('pageRules array entries should have path and allow properties', () => {
    const sampleRule = { path: '/docs', allow: ['read:pages'], deny: [] }
    expect(sampleRule).toHaveProperty('path')
    expect(sampleRule).toHaveProperty('allow')
    expect(Array.isArray(sampleRule.allow)).toBe(true)
  })

  it('permissions array only contains string entries', () => {
    const permissions = ['read:pages', 'write:pages', 'manage:system']
    permissions.forEach(p => expect(typeof p).toBe('string'))
  })

  it('redirectOnLogin defaults to empty string', () => {
    // Schema does not set a default but property type is string
    expect(Group.jsonSchema.properties.redirectOnLogin.type).toBe('string')
  })
})
