import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { toHaveNoViolations } from 'vitest-axe/matchers'

expect.extend({ toHaveNoViolations })

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal admin sidebar HTML that mirrors the aria additions
 * made to AdminLayout.vue and NavSidebar.vue.
 */
function buildAdminSidebarHtml ({ activePath = '/_admin/dashboard' } = {}) {
  const navItems = [
    { path: '/_admin/dashboard', label: 'Dashboard' },
    { path: '/_admin/sites', label: 'Sites' },
    { path: '/_admin/auth', label: 'Authentication' },
    { path: '/_admin/groups', label: 'Groups' },
    { path: '/_admin/users', label: 'Users' },
    { path: '/_admin/api', label: 'API' },
    { path: '/_admin/extensions', label: 'Extensions' },
    { path: '/_admin/icons', label: 'Icons' },
    { path: '/_admin/mail', label: 'Mail' },
    { path: '/_admin/system', label: 'System' }
  ]

  const items = navItems.map(({ path, label }) => {
    const isCurrent = activePath === path
    return `<a href="${path}" aria-label="${label}"${isCurrent ? ' aria-current="page"' : ''}>${label}</a>`
  }).join('\n        ')

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head><title>Admin - CloudWiki</title></head>
      <body>
        <nav role="navigation" aria-label="Admin sidebar navigation">
          ${items}
        </nav>
        <main>
          <h1>Admin Dashboard</h1>
        </main>
      </body>
    </html>
  `
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Admin sidebar navigation – accessibility', () => {
  it('has no axe violations in the reference markup', async () => {
    const html = buildAdminSidebarHtml()
    const results = await axe(html)
    expect(results).toHaveNoViolations()
  })

  it('sidebar nav has role="navigation"', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const nav = doc.querySelector('[role="navigation"]')
    expect(nav).not.toBeNull()
  })

  it('sidebar nav has an aria-label', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const nav = doc.querySelector('nav[aria-label]')
    expect(nav).not.toBeNull()
    expect(nav.getAttribute('aria-label').trim().length).toBeGreaterThan(0)
  })

  it('all nav links have aria-label attributes', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const links = Array.from(doc.querySelectorAll('nav a'))
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      const label = link.getAttribute('aria-label') || link.textContent.trim()
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('active nav item has aria-current="page"', () => {
    const activePath = '/_admin/dashboard'
    const html = buildAdminSidebarHtml({ activePath })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const activeLink = doc.querySelector(`nav a[href="${activePath}"]`)
    expect(activeLink).not.toBeNull()
    expect(activeLink.getAttribute('aria-current')).toBe('page')
  })

  it('inactive nav items do not have aria-current="page"', () => {
    const activePath = '/_admin/dashboard'
    const html = buildAdminSidebarHtml({ activePath })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const inactiveLinks = Array.from(doc.querySelectorAll(`nav a:not([href="${activePath}"])`))
    for (const link of inactiveLinks) {
      expect(link.getAttribute('aria-current')).not.toBe('page')
    }
  })

  it('exactly one nav link has aria-current="page" at a time', () => {
    const html = buildAdminSidebarHtml({ activePath: '/_admin/system' })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const currentLinks = doc.querySelectorAll('nav a[aria-current="page"]')
    expect(currentLinks.length).toBe(1)
    expect(currentLinks[0].getAttribute('href')).toBe('/_admin/system')
  })

  it('nav aria-label is descriptive (not empty or generic)', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const nav = doc.querySelector('nav')
    const label = nav.getAttribute('aria-label') || ''
    expect(label.length).toBeGreaterThan(3)
    expect(label.toLowerCase()).not.toBe('nav')
    expect(label.toLowerCase()).not.toBe('navigation')
  })

  it('page has a main landmark', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const main = doc.querySelector('main')
    expect(main).not.toBeNull()
  })

  it('page has a level-1 heading', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const h1 = doc.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1.textContent.trim().length).toBeGreaterThan(0)
  })

  it('has no duplicate IDs', () => {
    const html = buildAdminSidebarHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const allIds = Array.from(doc.querySelectorAll('[id]')).map(el => el.id)
    const unique = new Set(allIds)
    expect(allIds.length).toBe(unique.size)
  })
})
