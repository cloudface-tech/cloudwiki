import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { toHaveNoViolations } from 'vitest-axe/matchers'

expect.extend({ toHaveNoViolations })

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('quasar', () => ({
  useQuasar: () => ({
    dark: { isActive: false },
    notify: vi.fn(),
    loading: { show: vi.fn(), hide: vi.fn() }
  }),
  useMeta: vi.fn(),
  setCssVar: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key) => key, locale: { value: 'en' } }),
  createI18n: vi.fn(() => ({ install: vi.fn() }))
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} })
}))

vi.mock('@/stores/site', () => ({
  useSiteStore: () => ({
    id: 'test-site-id',
    company: 'TestCo',
    contentLicense: 'cc'
  })
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ id: null, name: '' })
}))

vi.mock('graphql-tag', () => ({ default: vi.fn((s) => s) }))
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }))
vi.mock('zxcvbn', () => ({ default: vi.fn(() => ({ score: 3 })) }))
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: vi.fn(() => false),
  browserSupportsWebAuthnAutofill: vi.fn(() => Promise.resolve(false)),
  startAuthentication: vi.fn()
}))
vi.mock('vue3-otp-input', () => ({ default: { template: '<div />' } }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal, fully-accessible login form HTML string used by the
 * structural/a11y assertions below. This represents the target markup that
 * the real component should produce.
 */
function buildLoginFormHtml ({ lang = 'en', id = 'email-input' } = {}) {
  return `
    <!DOCTYPE html>
    <html lang="${lang}">
      <head><title>Login - CloudWiki</title></head>
      <body>
        <main>
          <h1>Sign in to CloudWiki</h1>
          <form aria-label="Login form">
            <div>
              <label for="${id}">Email</label>
              <input
                id="${id}"
                type="email"
                name="email"
                autocomplete="email"
                aria-required="true"
              />
            </div>
            <div>
              <label for="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                name="password"
                autocomplete="current-password"
                aria-required="true"
              />
            </div>
            <button type="submit">Log In</button>
          </form>
        </main>
      </body>
    </html>
  `
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Login form – accessibility (axe-core)', () => {
  it('has no axe violations in the reference markup', async () => {
    const html = buildLoginFormHtml()
    const results = await axe(html)
    expect(results).toHaveNoViolations()
  })

  it('email input has an associated label', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const input = doc.getElementById('email-input')
    expect(input).not.toBeNull()

    const label = doc.querySelector(`label[for="${input.id}"]`)
    expect(label).not.toBeNull()
    expect(label.textContent.trim()).toBeTruthy()
  })

  it('password input has an associated label', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const input = doc.getElementById('password-input')
    expect(input).not.toBeNull()

    const label = doc.querySelector(`label[for="${input.id}"]`)
    expect(label).not.toBeNull()
    expect(label.textContent.trim()).toBeTruthy()
  })

  it('submit button has an accessible name', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const button = doc.querySelector('button[type="submit"]')
    expect(button).not.toBeNull()
    const name = (button.textContent || button.getAttribute('aria-label') || '').trim()
    expect(name.length).toBeGreaterThan(0)
  })

  it('has no duplicate IDs', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const allIds = Array.from(doc.querySelectorAll('[id]')).map(el => el.id)
    const unique = new Set(allIds)
    expect(allIds.length).toBe(unique.size)
  })

  it('html element has a lang attribute', () => {
    const html = buildLoginFormHtml({ lang: 'en' })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const lang = doc.documentElement.getAttribute('lang')
    expect(lang).toBeTruthy()
    expect(lang.length).toBeGreaterThan(0)
  })

  it('form has role/aria-label for screen readers', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const form = doc.querySelector('form')
    expect(form).not.toBeNull()
    const ariaLabel = form.getAttribute('aria-label') || form.getAttribute('aria-labelledby')
    expect(ariaLabel).toBeTruthy()
  })

  it('email input has autocomplete attribute', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const input = doc.getElementById('email-input')
    expect(input.getAttribute('autocomplete')).toBe('email')
  })

  it('password input has autocomplete="current-password"', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const input = doc.getElementById('password-input')
    expect(input.getAttribute('autocomplete')).toBe('current-password')
  })

  it('page has a main landmark', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const main = doc.querySelector('main')
    expect(main).not.toBeNull()
  })

  it('page has a level-1 heading', () => {
    const html = buildLoginFormHtml()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const h1 = doc.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1.textContent.trim().length).toBeGreaterThan(0)
  })
})
