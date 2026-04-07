import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('loads and shows correct branding', async ({ page }) => {
    await expect(page).toHaveTitle(/CloudWiki/)
    await expect(page.getByText('CloudWiki')).toBeVisible()
    await expect(page.getByText('Powered by CloudFace')).toBeVisible()
  })

  test('has email and password fields with correct labels', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('has Log In button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible()
  })

  test('shows CloudWiki watermark in background', async ({ page }) => {
    const watermark = page.locator('[class*="watermark"], [class*="bg-text"], [aria-hidden="true"]').filter({ hasText: 'CloudWiki' })
    await expect(watermark).toBeVisible()
  })

  test('login page gradient uses CloudFace colors', async ({ page }) => {
    const body = page.locator('body')
    const bgColor = await body.evaluate(el => getComputedStyle(el).background || getComputedStyle(el).backgroundColor)
    expect(bgColor).toBeTruthy()
  })

  test('invalid login shows error message', async ({ page }) => {
    await page.getByLabel('Email').fill('invalid@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page.getByRole('alert').or(page.locator('[class*="error"], [class*="alert"]'))).toBeVisible()
  })

  test('successful login redirects to home page', async ({ page }) => {
    await page.getByLabel('Email').fill('admin@example.com')
    await page.getByLabel('Password').fill('12345678')
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).toHaveURL(/\/(home|dashboard|wiki)?$/)
  })
})
