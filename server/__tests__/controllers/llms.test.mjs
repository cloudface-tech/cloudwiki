import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('llms.txt endpoints', () => {
  beforeEach(() => {
    WIKI.db = { sites: { getSiteByHostname: vi.fn() }, knex: vi.fn() }
  })

  describe('GET /llms.txt', () => {
    it('should generate page index with titles and links', async () => {
      const site = { id: 's1', config: { title: 'CloudWiki', description: 'Knowledge platform' } }
      const pages = [
        { path: 'home', title: 'Welcome', description: 'Home page', updatedAt: '2026-01-01' },
        { path: 'features', title: 'Features', description: 'Feature list', updatedAt: '2026-01-02' }
      ]

      WIKI.db.sites.getSiteByHostname.mockResolvedValue(site)
      WIKI.db.knex.mockReturnValue({ where: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(pages) }) }) })

      const s = await WIKI.db.sites.getSiteByHostname({ hostname: 'wiki.cloudface.tech' })
      const p = await WIKI.db.knex('pages').where({ siteId: s.id, publishState: 'published' }).select('path', 'title', 'description', 'updatedAt').orderBy('path')

      let output = `# ${s.config.title}\n\n> ${s.config.description}\n\n`
      for (const pg of p) output += `- [${pg.title}](https://wiki.cloudface.tech/${pg.path}): ${pg.description}\n`

      expect(output).toContain('# CloudWiki')
      expect(output).toContain('> Knowledge platform')
      expect(output).toContain('[Welcome](https://wiki.cloudface.tech/home): Home page')
      expect(output).toContain('[Features](https://wiki.cloudface.tech/features): Feature list')
    })

    it('should return null for unknown site', async () => {
      WIKI.db.sites.getSiteByHostname.mockResolvedValue(null)
      expect(await WIKI.db.sites.getSiteByHostname({ hostname: 'x' })).toBeNull()
    })
  })

  describe('GET /llms-full.txt', () => {
    it('should include full page content', async () => {
      const pages = [
        { path: 'home', title: 'Welcome', description: 'Home', content: '# Welcome\n\nHello world' },
        { path: 'features', title: 'Features', description: '', content: '# Features\n\n- Collab' }
      ]

      let output = '# Wiki\n\n> Desc\n\n---\n\n'
      for (const pg of pages) {
        output += `# ${pg.title}\n\n`
        if (pg.description) output += `> ${pg.description}\n\n`
        output += `${pg.content}\n\n---\n\n`
      }

      expect(output).toContain('Hello world')
      expect(output).toContain('- Collab')
      expect(output).not.toContain('> \n')
    })

    it('should filter to published pages only', async () => {
      WIKI.db.knex.mockReturnValue({
        where: vi.fn().mockImplementation((f) => {
          expect(f.publishState).toBe('published')
          return { select: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }
        })
      })
      await WIKI.db.knex('pages').where({ siteId: '1', publishState: 'published' }).select().orderBy('path')
    })
  })
})
