import { test, expect } from '@playwright/test'

test.describe('Branding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page title contains CloudWiki', async ({ page }) => {
    await expect(page).toHaveTitle(/CloudWiki/)
  })

  test('no Wiki.js or wikijs text visible anywhere on the page', async ({ page }) => {
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Wiki\.js/i)
    expect(bodyText).not.toMatch(/wikijs/i)
  })

  test('logo image loads successfully', async ({ page }) => {
    const logo = page.locator('img[alt*="logo" i], img[alt*="cloudwiki" i], img[class*="logo" i], header img').first()
    await expect(logo).toBeVisible()
    const naturalWidth = await logo.evaluate(el => el.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
  })

  test('footer shows CloudFace branding', async ({ page }) => {
    const footer = page.locator('footer, [class*="footer"]').first()
    await expect(footer.getByText(/CloudFace/i)).toBeVisible()
  })
})
