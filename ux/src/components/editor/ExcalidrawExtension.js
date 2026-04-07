import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ExcalidrawNodeView from './ExcalidrawNodeView.vue'

export const ExcalidrawExtension = Node.create({
  name: 'excalidrawBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes () {
    return {
      elements: { default: [] },
      appState: { default: {} },
      width: { default: 800 },
      height: { default: 400 }
    }
  },

  parseHTML () {
    return [{ tag: 'div[data-type="excalidraw-block"]' }]
  },

  renderHTML ({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'excalidraw-block' })]
  },

  addNodeView () {
    return VueNodeViewRenderer(ExcalidrawNodeView)
  }
})
