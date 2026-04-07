import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import MermaidNodeView from './MermaidNodeView.vue'

export const MermaidExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes () {
    return {
      code: {
        default: 'flowchart TD\n  Start --> End'
      }
    }
  },

  parseHTML () {
    return [{ tag: 'div[data-type="mermaid-block"]' }]
  },

  renderHTML ({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid-block' })]
  },

  addNodeView () {
    return VueNodeViewRenderer(MermaidNodeView)
  }
})
