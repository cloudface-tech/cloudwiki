import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { ExcalidrawExtension } from '../../src/components/editor/ExcalidrawExtension.js'

function createEditor (content) {
  return new Editor({
    extensions: [Document, Paragraph, Text, ExcalidrawExtension],
    content
  })
}

describe('ExcalidrawExtension', () => {
  it('should register excalidrawBlock node type', () => {
    const editor = createEditor('<p>test</p>')
    expect(editor.schema.nodes.excalidrawBlock).toBeDefined()
    editor.destroy()
  })

  it('should parse excalidrawBlock from JSON with elements', () => {
    const json = {
      type: 'doc',
      content: [{
        type: 'excalidrawBlock',
        attrs: {
          elements: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }],
          appState: {},
          width: 800,
          height: 400
        }
      }]
    }
    const editor = createEditor(json)
    const doc = editor.getJSON()
    expect(doc.content[0].type).toBe('excalidrawBlock')
    expect(doc.content[0].attrs.elements).toHaveLength(1)
    editor.destroy()
  })

  it('should have empty defaults', () => {
    const editor = createEditor('<p>test</p>')
    editor.commands.insertContent({ type: 'excalidrawBlock' })
    const json = editor.getJSON()
    const node = json.content.find(n => n.type === 'excalidrawBlock')
    expect(node.attrs.elements).toEqual([])
    expect(node.attrs.width).toBe(800)
    expect(node.attrs.height).toBe(400)
    editor.destroy()
  })
})
