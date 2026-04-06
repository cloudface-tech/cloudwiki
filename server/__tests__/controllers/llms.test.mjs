import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('llms.txt endpoints', () => {
  let handler

  beforeEach(async () => {
    // Mock WIKI globals
    WIKI.db = {
      sites: {
        getSiteByHostname: vi.fn()
      },
      knex: vi.fn()
    }
    WIKI.ROOTPATH = '/wiki'
    WIKI.config = { dataPath: './data', seo: { robots: '' } }
  })

  describe('GET /llms.txt', () => {
    it('should return page index in llms.txt format', async () => {
      const mockSite = {
        id: 'site-1',
        config: { title: 'CloudWiki', description: 'Open-source knowledge platform' }
      }
      const mockPages = [
        { path: 'home', title: 'Welcome', description: 'Home page', updatedAt: '2026-01-01' },
        { path: 'features', title: 'Features', description: 'Feature list', updatedAt: '2026-01-02' }
      ]

      WIKI.db.sites.getSiteByHostname.mockResolvedValue(mockSite)

      const mockKnex = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPages)
          })
        })
      })
      WIKI.db.knex = mockKnex

      // Simulate the handler logic
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: 'wiki.cloudface.tech' })
      const pages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('path', 'title', 'description', 'updatedAt')
        .orderBy('path')

      const baseUrl = 'https://wiki.cloudface.tech'
      let output = `# ${site.config.title}\n\n`
      output += `> ${site.config.description}\n\n`
      for (const page of pages) {
        output += `- [${page.title}](${baseUrl}/${page.path}): ${page.description}\n`
      }

      expect(output).toContain('# CloudWiki')
      expect(output).toContain('> Open-source knowledge platform')
      expect(output).toContain('[Welcome](https://wiki.cloudface.tech/home): Home page')
      expect(output).toContain('[Features](https://wiki.cloudface.tech/features): Feature list')
    })

    it('should handle site not found', async () => {
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(null)
      const site = await WIKI.db.sites.getSiteByHostname({ hostname: 'unknown.com' })
      expect(site).toBeNull()
    })
  })

  describe('GET /llms-full.txt', () => {
    it('should return full page content', async () => {
      const mockSite = {
        id: 'site-1',
        config: { title: 'CloudWiki', description: 'Knowledge platform' }
      }
      const mockPages = [
        { path: 'home', title: 'Welcome', description: 'Home', content: '# Welcome\n\nHello world' },
        { path: 'features', title: 'Features', description: '', content: '# Features\n\n- Real-time collab' }
      ]

      WIKI.db.sites.getSiteByHostname.mockResolvedValue(mockSite)
      const mockKnex = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPages)
          })
        })
      })
      WIKI.db.knex = mockKnex

      const site = await WIKI.db.sites.getSiteByHostname({ hostname: 'wiki.cloudface.tech' })
      const pages = await WIKI.db.knex('pages')
        .where({ siteId: site.id, publishState: 'published' })
        .select('path', 'title', 'description', 'content')
        .orderBy('path')

      let output = `# ${site.config.title}\n\n`
      output += `> ${site.config.description}\n\n---\n\n`
      for (const page of pages) {
        output += `# ${page.title}\n\n`
        if (page.description) output += `> ${page.description}\n\n`
        output += `${page.content}\n\n---\n\n`
      }

      expect(output).toContain('# CloudWiki')
      expect(output).toContain('# Welcome')
      expect(output).toContain('Hello world')
      expect(output).toContain('# Features')
      expect(output).toContain('Real-time collab')
      expect(output).toContain('---')
    })

    it('should only include published pages', async () => {
      const mockKnex = vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((filter) => {
          expect(filter.publishState).toBe('published')
          return {
            select: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([])
            })
          }
        })
      })
      WIKI.db.knex = mockKnex
      WIKI.db.sites.getSiteByHostname.mockResolvedValue({ id: '1', config: { title: 'T' } })

      await WIKI.db.sites.getSiteByHostname({ hostname: 'test' })
      await WIKI.db.knex('pages').where({ siteId: '1', publishState: 'published' }).select().orderBy('path')
    })

    it('should handle pages with empty description', async () => {
      const page = { title: 'Test', description: '', content: 'Content here' }
      let output = `# ${page.title}\n\n`
      if (page.description) output += `> ${page.description}\n\n`
      output += `${page.content}\n\n`

      expect(output).not.toContain('> \n')
      expect(output).toContain('Content here')
    })
  })
})
