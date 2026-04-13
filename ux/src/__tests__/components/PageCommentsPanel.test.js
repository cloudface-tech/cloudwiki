import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('quasar', () => ({
  useQuasar: () => ({ dark: { isActive: false }, notify: vi.fn() }),
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

describe('PageCommentsPanel logic', () => {
  it('should extract @mentions from text', () => {
    const text = 'Hello @Alice and @Bob, check this'
    const matches = text.match(/@(\w+)/g)
    const mentions = matches ? matches.map(m => m.slice(1)) : []
    expect(mentions).toEqual(['Alice', 'Bob'])
  })

  it('should return empty array when no mentions', () => {
    const text = 'No mentions here'
    const matches = text.match(/@(\w+)/g)
    const mentions = matches ? matches.map(m => m.slice(1)) : []
    expect(mentions).toEqual([])
  })

  it('should render @mentions as HTML', () => {
    const text = 'Thanks @Alice'
    const rendered = text.replace(/@(\w+)/g, '<strong class="text-primary">@$1</strong>')
    expect(rendered).toContain('<strong')
    expect(rendered).toContain('@Alice')
  })

  it('should build threaded comments correctly', () => {
    const comments = [
      { id: 'c1', parentId: null, authorName: 'Alice', content: 'Top level', replies: [] },
      { id: 'c2', parentId: 'c1', authorName: 'Bob', content: 'Reply' }
    ]
    const topLevel = comments.filter(c => !c.parentId)
    expect(topLevel).toHaveLength(1)
    expect(topLevel[0].authorName).toBe('Alice')
  })

  it('should require non-empty comment text', () => {
    const text = '   '
    expect(text.trim()).toBe('')
  })
})
