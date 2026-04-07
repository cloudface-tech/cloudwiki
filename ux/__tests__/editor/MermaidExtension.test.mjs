import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { MermaidExtension } from '../../src/components/editor/MermaidExtension.js'

function createEditor (content) {
  return new Editor({
    extensions: [Document, Paragraph, Text, MermaidExtension],
    content
  })
}

describe('MermaidExtension', () => {
  it('should register mermaidBlock node type', () => {
    const editor = createEditor('<p>test</p>')
    expect(editor.schema.nodes.mermaidBlock).toBeDefined()
    editor.destroy()
  })

  it('should parse mermaidBlock from JSON', () => {
    const json = {
      type: 'doc',
      content: [{
        type: 'mermaidBlock',
        attrs: { code: 'flowchart TD\n  A-->B' }
      }]
    }
    const editor = createEditor(json)
    const doc = editor.getJSON()
    expect(doc.content[0].type).toBe('mermaidBlock')
    expect(doc.content[0].attrs.code).toBe('flowchart TD\n  A-->B')
    editor.destroy()
  })

  it('should serialize mermaidBlock to JSON with code attr', () => {
    const editor = createEditor('<p>test</p>')
    editor.commands.insertContent({
      type: 'mermaidBlock',
      attrs: { code: 'graph LR\n  A-->B' }
    })
    const json = editor.getJSON()
    const mermaidNode = json.content.find(n => n.type === 'mermaidBlock')
    expect(mermaidNode).toBeDefined()
    expect(mermaidNode.attrs.code).toBe('graph LR\n  A-->B')
    editor.destroy()
  })

  it('should have default template code attribute', () => {
    const editor = createEditor('<p>test</p>')
    editor.commands.insertContent({ type: 'mermaidBlock' })
    const json = editor.getJSON()
    const mermaidNode = json.content.find(n => n.type === 'mermaidBlock')
    expect(mermaidNode.attrs.code).toBe('flowchart TD\n  Start --> End')
    editor.destroy()
  })
})
