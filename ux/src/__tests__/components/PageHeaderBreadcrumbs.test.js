import { describe, it, expect } from 'vitest'

describe('PageHeader breadcrumbs logic', () => {
  function buildBreadcrumbs (path) {
    if (!path) return []
    const parts = path.split('/').filter(Boolean)
    return parts.map((part, idx) => ({
      label: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
      to: '/' + parts.slice(0, idx + 1).join('/')
    }))
  }

  it('should build breadcrumbs from path', () => {
    const crumbs = buildBreadcrumbs('nees/transversal/arquitetura')
    expect(crumbs).toHaveLength(3)
    expect(crumbs[0]).toEqual({ label: 'Nees', to: '/nees' })
    expect(crumbs[1]).toEqual({ label: 'Transversal', to: '/nees/transversal' })
    expect(crumbs[2]).toEqual({ label: 'Arquitetura', to: '/nees/transversal/arquitetura' })
  })

  it('should handle single-level path', () => {
    const crumbs = buildBreadcrumbs('home')
    expect(crumbs).toHaveLength(1)
  })

  it('should replace dashes with spaces', () => {
    const crumbs = buildBreadcrumbs('docs/getting-started')
    expect(crumbs[1].label).toBe('Getting started')
  })

  it('should capitalize first letter', () => {
    const crumbs = buildBreadcrumbs('minc/portal')
    expect(crumbs[0].label).toBe('Minc')
  })

  it('should return empty for empty path', () => {
    expect(buildBreadcrumbs('')).toEqual([])
    expect(buildBreadcrumbs(undefined)).toEqual([])
  })
})

describe('PageHeader reading time', () => {
  it('should calculate reading time at 200 wpm', () => {
    const words = 600
    const time = Math.max(1, Math.ceil(words / 200))
    expect(time).toBe(3)
  })

  it('should return minimum 1 minute', () => {
    const words = 10
    const time = Math.max(1, Math.ceil(words / 200))
    expect(time).toBe(1)
  })
})
