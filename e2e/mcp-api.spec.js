import { test, expect } from '@playwright/test'

const BASE_URL = process.env.WIKI_URL || 'https://wiki.dev.cultbr.cultura.gov.br'
const API = `${BASE_URL}/api/mcp`

test.describe('MCP API E2E', () => {
  test('manifest returns v3 with write capabilities', async ({ request }) => {
    const resp = await request.get(`${API}/manifest`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.version).toBe('3.0.0')
    expect(data.capabilities.pages.create).toBe(true)
    expect(data.capabilities.pages.delete).toBe(true)
    expect(data.capabilities.templates).toBeDefined()
  })

  test('list pages returns paginated results', async ({ request }) => {
    const resp = await request.get(`${API}/pages?limit=3`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.pages.length).toBeGreaterThan(0)
    expect(data.pagination.total).toBeGreaterThan(0)
  })

  test('search returns results with excerpts', async ({ request }) => {
    const resp = await request.get(`${API}/search?q=manual&limit=3`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.query).toBe('manual')
    expect(data.pages).toBeDefined()
  })

  test('AI ask returns ranked results', async ({ request }) => {
    const resp = await request.post(`${API}/ask`, {
      data: { question: 'configurar', limit: 3 }
    })
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.question).toBe('configurar')
    expect(data.method).toBeDefined()
    expect(data.results).toBeDefined()
  })

  test('recent pages returns ordered list', async ({ request }) => {
    const resp = await request.get(`${API}/recent?limit=5`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.pages.length).toBeGreaterThan(0)
  })

  test('templates list returns results', async ({ request }) => {
    const resp = await request.get(`${API}/templates`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.total).toBeGreaterThanOrEqual(0)
  })

  test('stale pages returns with threshold', async ({ request }) => {
    const resp = await request.get(`${API}/stale?days=90`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(data.thresholdDays).toBe(90)
  })

  test('CRUD lifecycle: create, read, update, delete', async ({ request }) => {
    // Create
    const createResp = await request.post(`${API}/pages`, {
      data: {
        title: 'E2E Test Page',
        path: 'test/e2e-lifecycle-' + Date.now(),
        content: '# E2E Test',
        format: 'markdown',
        locale: 'en',
        tags: ['e2e-test']
      }
    })
    expect(createResp.ok()).toBeTruthy()
    const created = await createResp.json()
    expect(created.id).toBeDefined()

    // Read
    const readResp = await request.get(`${API}/pages/${created.id}`)
    expect(readResp.ok()).toBeTruthy()
    const read = await readResp.json()
    expect(read.title).toBe('E2E Test Page')

    // Update
    const updateResp = await request.put(`${API}/pages/${created.id}`, {
      data: { title: 'E2E Test Page Updated' }
    })
    expect(updateResp.ok()).toBeTruthy()
    const updated = await updateResp.json()
    expect(updated.title).toBe('E2E Test Page Updated')

    // Delete
    const deleteResp = await request.delete(`${API}/pages/${created.id}`)
    expect(deleteResp.ok()).toBeTruthy()
    const deleted = await deleteResp.json()
    expect(deleted.deleted).toBe(true)
  })

  test('public docs portal serves HTML', async ({ request }) => {
    const resp = await request.get(`${API}/docs/home`)
    expect(resp.ok()).toBeTruthy()
    const html = await resp.text()
    expect(html).toContain('CloudWiki')
  })
})
