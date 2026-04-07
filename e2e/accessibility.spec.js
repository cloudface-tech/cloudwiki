import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('login page has no critical a11y violations', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    )

    expect(critical).toEqual([])
  })

  test('login page form inputs have proper labels', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['label', 'label-content-name-mismatch'])
      .analyze()

    const violations = results.violations
    expect(violations).toEqual([])
  })

  test('login page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['heading-order', 'empty-heading'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('login page images have alt text', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('login page buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['button-name', 'focusable-no-name'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('login page color contrast meets AA standards', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze()

    const critical = results.violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    )

    expect(critical).toEqual([])
  })

  test('home page has no critical a11y violations', async ({ page }) => {
    // Attempt login first
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password')
    const loginButton = page.getByRole('button', { name: 'Log In' })

    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@example.com')
      await passwordInput.fill('12345678')
      await loginButton.click()
      await page.waitForLoadState('networkidle')
    } else {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    )

    expect(critical).toEqual([])
  })

  test('admin dashboard has no critical a11y violations', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel('Email')
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@example.com')
      await page.getByLabel('Password').fill('12345678')
      await page.getByRole('button', { name: 'Log In' }).click()
      await page.waitForLoadState('networkidle')
    }

    await page.goto('/_admin/dashboard')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    const critical = results.violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    )

    expect(critical).toEqual([])
  })

  test('admin dashboard sidebar navigation has proper ARIA roles', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel('Email')
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@example.com')
      await page.getByLabel('Password').fill('12345678')
      await page.getByRole('button', { name: 'Log In' }).click()
      await page.waitForLoadState('networkidle')
    }

    await page.goto('/_admin/dashboard')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['aria-allowed-role', 'aria-required-children', 'aria-required-parent', 'landmark-no-duplicate-banner', 'landmark-no-duplicate-main'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('admin dashboard all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel('Email')
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@example.com')
      await page.getByLabel('Password').fill('12345678')
      await page.getByRole('button', { name: 'Log In' }).click()
      await page.waitForLoadState('networkidle')
    }

    await page.goto('/_admin/dashboard')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withRules(['focusable-no-name', 'tabindex'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})
