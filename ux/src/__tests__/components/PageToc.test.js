import { describe, it, expect } from 'vitest'

describe('PageToc logic', () => {
  function extractToc (html) {
    const regex = /<h([1-4])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi
    const items = []
    let match
    while ((match = regex.exec(html)) !== null) {
      items.push({
        level: parseInt(match[1]),
        id: match[2],
        text: match[3].replace(/<[^>]+>/g, '').trim()
      })
    }
    return items
  }

  it('should extract headings with IDs from HTML', () => {
    const html = '<h1 id="intro">Introduction</h1><p>text</p><h2 id="setup">Setup</h2><h3 id="prereq">Prerequisites</h3>'
    const toc = extractToc(html)
    expect(toc).toHaveLength(3)
    expect(toc[0]).toEqual({ level: 1, id: 'intro', text: 'Introduction' })
    expect(toc[1]).toEqual({ level: 2, id: 'setup', text: 'Setup' })
    expect(toc[2]).toEqual({ level: 3, id: 'prereq', text: 'Prerequisites' })
  })

  it('should strip inner HTML tags from heading text', () => {
    const html = '<h2 id="test"><strong>Bold</strong> heading</h2>'
    const toc = extractToc(html)
    expect(toc[0].text).toBe('Bold heading')
  })

  it('should return empty array for no headings', () => {
    const html = '<p>No headings here</p>'
    const toc = extractToc(html)
    expect(toc).toHaveLength(0)
  })

  it('should only extract h1-h4', () => {
    const html = '<h1 id="a">A</h1><h5 id="b">B</h5><h6 id="c">C</h6>'
    const toc = extractToc(html)
    expect(toc).toHaveLength(1)
  })
})
