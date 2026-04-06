import { test, expect } from '@playwright/test'

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@example.com')
    await page.getByLabel('Password').fill('12345678')
    await page.getByRole('button', { name: 'Log In' }).click()
    await page.waitForURL(url => !url.pathname.includes('/login'))
  })

  test('admin dashboard is accessible after login', async ({ page }) => {
    await page.goto('/_admin')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('admin sidebar shows correct navigation items', async ({ page }) => {
    await page.goto('/_admin')
    const sidebar = page.locator('nav, [class*="sidebar"], [class*="nav"]').first()
    await expect(sidebar).toBeVisible()
    const navItems = ['Dashboard', 'Users', 'Pages', 'Settings']
    for (const item of navItems) {
      await expect(sidebar.getByText(item)).toBeVisible()
    }
  })

  test('admin header shows CloudWiki title', async ({ page }) => {
    await page.goto('/_admin')
    const header = page.locator('header, [class*="header"], [class*="toolbar"]').first()
    await expect(header.getByText('CloudWiki')).toBeVisible()
  })

  test('admin has no references to Wiki.js in any visible text', async ({ page }) => {
    await page.goto('/_admin')
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Wiki\.js/i)
    expect(bodyText).not.toMatch(/wikijs/i)
  })
})
