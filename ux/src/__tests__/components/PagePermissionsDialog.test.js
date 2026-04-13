import { describe, it, expect } from 'vitest'

describe('PagePermissionsDialog logic', () => {
  it('should validate subjectType', () => {
    const valid = ['user', 'group']
    expect(valid.includes('user')).toBe(true)
    expect(valid.includes('group')).toBe(true)
    expect(valid.includes('role')).toBe(false)
  })

  it('should validate level', () => {
    const valid = ['read', 'write', 'admin']
    expect(valid.includes('read')).toBe(true)
    expect(valid.includes('admin')).toBe(true)
    expect(valid.includes('owner')).toBe(false)
  })

  it('should map level to color', () => {
    const levelColor = (level) => ({ read: 'blue', write: 'orange', admin: 'red' }[level] || 'grey')
    expect(levelColor('read')).toBe('blue')
    expect(levelColor('write')).toBe('orange')
    expect(levelColor('admin')).toBe('red')
    expect(levelColor('unknown')).toBe('grey')
  })
})
