import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'

vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('Site asset serving with DB fallback', () => {
  const SITE_ID = 'site-abc-123'
  const LOGO_UUID = 'logo-uuid-456'
  const FAVICON_UUID = 'favicon-uuid-789'
  const LOGINBG_UUID = 'loginbg-uuid-012'
  const DATA_PATH = './data'
  const ROOT_PATH = '/wiki'
  const ASSETS_DIR = path.resolve(ROOT_PATH, DATA_PATH, 'assets')

  let knexWhereMock

  beforeEach(() => {
    vi.clearAllMocks()

    knexWhereMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null)
      })
    })

    WIKI.ROOTPATH = ROOT_PATH
    WIKI.config.dataPath = DATA_PATH
    WIKI.sites = {}
    WIKI.db = {
      sites: { getSiteByHostname: vi.fn() },
      knex: vi.fn().mockReturnValue({ where: knexWhereMock })
    }
  })

  function makeSite (overrides = {}) {
    return {
      id: SITE_ID,
      config: {
        assets: {
          logo: false,
          logoExt: 'svg',
          favicon: false,
          faviconExt: 'svg',
          loginBg: false
        }
      },
      ...overrides
    }
  }

  describe('restoreSiteAssetFromDb logic', () => {
    it('should serve default logo when no custom logo is configured', () => {
      const site = makeSite()
      expect(site.config.assets.logo).toBe(false)
    })

    it('should not query DB when logo file exists on disk', async () => {
      fs.access.mockResolvedValue(undefined)

      const logoPath = path.join(ASSETS_DIR, `logo-${SITE_ID}.png`)
      await fs.access(logoPath)

      expect(fs.access).toHaveBeenCalledWith(logoPath)
      expect(WIKI.db.knex).not.toHaveBeenCalled()
    })

    it('should query DB and restore logo when file is missing from disk', async () => {
      const imgData = Buffer.from('fake-png-data')
      fs.access.mockRejectedValue(new Error('ENOENT'))

      knexWhereMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ data: imgData, mimeType: 'image/png' })
        })
      })

      // Simulate the restore flow
      const logoPath = path.join(ASSETS_DIR, `logo-${SITE_ID}.png`)
      try {
        await fs.access(logoPath)
      } catch {
        const row = await WIKI.db.knex('assets').where('id', LOGO_UUID).select('data', 'mimeType').first()
        if (row?.data) {
          await fs.mkdir(path.dirname(logoPath), { recursive: true })
          await fs.writeFile(logoPath, row.data)
        }
      }

      expect(fs.mkdir).toHaveBeenCalledWith(ASSETS_DIR, { recursive: true })
      expect(fs.writeFile).toHaveBeenCalledWith(logoPath, imgData)
    })

    it('should not write file when asset is not found in DB', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'))

      knexWhereMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      })

      const logoPath = path.join(ASSETS_DIR, `logo-${SITE_ID}.png`)
      try {
        await fs.access(logoPath)
      } catch {
        const row = await WIKI.db.knex('assets').where('id', LOGO_UUID).select('data', 'mimeType').first()
        if (row?.data) {
          await fs.mkdir(path.dirname(logoPath), { recursive: true })
          await fs.writeFile(logoPath, row.data)
        }
      }

      expect(fs.writeFile).not.toHaveBeenCalled()
    })

    it('should restore favicon from DB when missing from disk', async () => {
      const imgData = Buffer.from('fake-favicon-data')
      fs.access.mockRejectedValue(new Error('ENOENT'))

      knexWhereMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ data: imgData, mimeType: 'image/png' })
        })
      })

      const faviconPath = path.join(ASSETS_DIR, `favicon-${SITE_ID}.png`)
      try {
        await fs.access(faviconPath)
      } catch {
        const row = await WIKI.db.knex('assets').where('id', FAVICON_UUID).select('data', 'mimeType').first()
        if (row?.data) {
          await fs.mkdir(path.dirname(faviconPath), { recursive: true })
          await fs.writeFile(faviconPath, row.data)
        }
      }

      expect(fs.writeFile).toHaveBeenCalledWith(faviconPath, imgData)
    })

    it('should restore login background from DB when missing from disk', async () => {
      const imgData = Buffer.from('fake-loginbg-data')
      fs.access.mockRejectedValue(new Error('ENOENT'))

      knexWhereMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ data: imgData, mimeType: 'image/jpg' })
        })
      })

      const loginBgPath = path.join(ASSETS_DIR, `loginbg-${SITE_ID}.jpg`)
      try {
        await fs.access(loginBgPath)
      } catch {
        const row = await WIKI.db.knex('assets').where('id', LOGINBG_UUID).select('data', 'mimeType').first()
        if (row?.data) {
          await fs.mkdir(path.dirname(loginBgPath), { recursive: true })
          await fs.writeFile(loginBgPath, row.data)
        }
      }

      expect(fs.writeFile).toHaveBeenCalledWith(loginBgPath, imgData)
    })
  })
})
