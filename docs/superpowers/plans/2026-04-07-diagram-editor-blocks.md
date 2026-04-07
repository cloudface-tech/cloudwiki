# Diagram Editor Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mermaid code blocks and Excalidraw visual blocks as collaborative TipTap nodes in the CloudWiki WYSIWYG editor.

**Architecture:** Two new TipTap Node extensions (MermaidBlock, ExcalidrawBlock) registered in EditorWysiwyg.vue. Mermaid renders client-side via mermaid.js. Excalidraw renders via React wrapper mounted in Vue. Both sync through existing Yjs/Hocuspocus infrastructure.

**Tech Stack:** TipTap 2.27.2, Vue 3, mermaid.js, @excalidraw/excalidraw, y-excalidraw, Yjs

**Repo:** /tmp/cloudwiki-fix

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `ux/src/components/editor/MermaidExtension.js` | TipTap Node definition for Mermaid blocks |
| Create | `ux/src/components/editor/MermaidNodeView.vue` | Vue component for Mermaid node rendering (code + preview) |
| Create | `ux/src/components/editor/ExcalidrawExtension.js` | TipTap Node definition for Excalidraw blocks |
| Create | `ux/src/components/editor/ExcalidrawNodeView.vue` | Vue wrapper that mounts React Excalidraw inline |
| Create | `ux/src/components/editor/ExcalidrawModal.vue` | Fullscreen modal for Excalidraw editing |
| Create | `ux/src/components/editor/DiagramToolbarMenu.vue` | Toolbar dropdown menu for inserting diagrams |
| Modify | `ux/src/components/EditorWysiwyg.vue` | Register extensions, add toolbar button |
| Modify | `ux/package.json` | Add dependencies |
| Create | `ux/__tests__/editor/MermaidExtension.test.mjs` | Tests for Mermaid node |
| Create | `ux/__tests__/editor/ExcalidrawExtension.test.mjs` | Tests for Excalidraw node |

---

### Task 1: Add dependencies

**Files:**
- Modify: `ux/package.json`

- [ ] **Step 1: Install mermaid and excalidraw packages**

```bash
cd /tmp/cloudwiki-fix/ux
pnpm add mermaid @excalidraw/excalidraw react react-dom y-excalidraw
```

Note: `react` and `react-dom` are needed for Excalidraw. They will be isolated — not used by the Vue app directly.

- [ ] **Step 2: Verify install**

Run: `cd /tmp/cloudwiki-fix/ux && pnpm ls mermaid @excalidraw/excalidraw`
Expected: Both packages listed

- [ ] **Step 3: Commit**

```bash
git add ux/package.json ux/pnpm-lock.yaml
git commit -m "feat: add mermaid and excalidraw dependencies"
```

---

### Task 2: Create MermaidExtension TipTap node

**Files:**
- Create: `ux/src/components/editor/MermaidExtension.js`
- Test: `ux/__tests__/editor/MermaidExtension.test.mjs`

- [ ] **Step 1: Write test for Mermaid node schema**

```javascript
// ux/__tests__/editor/MermaidExtension.test.mjs
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

  it('should have default empty code attribute', () => {
    const editor = createEditor('<p>test</p>')
    editor.commands.insertContent({ type: 'mermaidBlock' })
    const json = editor.getJSON()
    const mermaidNode = json.content.find(n => n.type === 'mermaidBlock')
    expect(mermaidNode.attrs.code).toBe('flowchart TD\n  Start --> End')
    editor.destroy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run __tests__/editor/MermaidExtension.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MermaidExtension**

```javascript
// ux/src/components/editor/MermaidExtension.js
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
```

- [ ] **Step 4: Create minimal MermaidNodeView stub**

```vue
<!-- ux/src/components/editor/MermaidNodeView.vue -->
<template>
  <node-view-wrapper class="mermaid-block">
    <div class="mermaid-block__container">
      <div class="mermaid-block__editor">
        <textarea
          :value="node.attrs.code"
          @input="updateCode($event.target.value)"
          rows="6"
          spellcheck="false"
        />
      </div>
      <div class="mermaid-block__preview" ref="previewRef" />
    </div>
  </node-view-wrapper>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import mermaid from 'mermaid'

const props = defineProps(nodeViewProps)
const previewRef = ref(null)

mermaid.initialize({ startOnLoad: false, theme: 'neutral' })

function updateCode (value) {
  props.updateAttributes({ code: value })
}

async function renderDiagram () {
  if (!previewRef.value) return
  try {
    const { svg } = await mermaid.render(
      `mermaid-${props.node.attrs.code.length}`,
      props.node.attrs.code
    )
    previewRef.value.innerHTML = svg
  } catch {
    previewRef.value.innerHTML = '<p style="color:red">Invalid Mermaid syntax</p>'
  }
}

onMounted(renderDiagram)
watch(() => props.node.attrs.code, renderDiagram)
</script>

<style scoped>
.mermaid-block__container {
  display: flex;
  gap: 1rem;
  border: 1px solid var(--md-sys-color-outline-variant, #ccc);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}
.mermaid-block__editor { flex: 1; }
.mermaid-block__editor textarea {
  width: 100%;
  font-family: monospace;
  font-size: 0.85rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  resize: vertical;
}
.mermaid-block__preview { flex: 1; overflow: auto; }
</style>
```

- [ ] **Step 5: Run tests**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run __tests__/editor/MermaidExtension.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ux/src/components/editor/MermaidExtension.js ux/src/components/editor/MermaidNodeView.vue ux/__tests__/editor/MermaidExtension.test.mjs
git commit -m "feat: add MermaidBlock TipTap extension with live preview"
```

---

### Task 3: Create ExcalidrawExtension TipTap node

**Files:**
- Create: `ux/src/components/editor/ExcalidrawExtension.js`
- Create: `ux/src/components/editor/ExcalidrawNodeView.vue`
- Create: `ux/src/components/editor/ExcalidrawModal.vue`
- Test: `ux/__tests__/editor/ExcalidrawExtension.test.mjs`

- [ ] **Step 1: Write test for Excalidraw node schema**

```javascript
// ux/__tests__/editor/ExcalidrawExtension.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run __tests__/editor/ExcalidrawExtension.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement ExcalidrawExtension**

```javascript
// ux/src/components/editor/ExcalidrawExtension.js
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
```

- [ ] **Step 4: Create ExcalidrawNodeView (inline preview + click to open modal)**

```vue
<!-- ux/src/components/editor/ExcalidrawNodeView.vue -->
<template>
  <node-view-wrapper class="excalidraw-block">
    <div
      class="excalidraw-block__preview"
      :style="{ width: node.attrs.width + 'px', height: node.attrs.height + 'px' }"
      @click="openModal"
    >
      <div v-if="node.attrs.elements.length === 0" class="excalidraw-block__empty">
        Click to start drawing
      </div>
      <div v-else ref="previewRef" class="excalidraw-block__svg" />
    </div>
    <ExcalidrawModal
      v-if="showModal"
      :elements="node.attrs.elements"
      :app-state="node.attrs.appState"
      @close="closeModal"
      @save="saveScene"
    />
  </node-view-wrapper>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import ExcalidrawModal from './ExcalidrawModal.vue'

const props = defineProps(nodeViewProps)
const showModal = ref(false)
const previewRef = ref(null)

function openModal () {
  showModal.value = true
}

function closeModal () {
  showModal.value = false
}

function saveScene ({ elements, appState }) {
  props.updateAttributes({ elements, appState })
  showModal.value = false
}

async function renderPreview () {
  if (!previewRef.value || props.node.attrs.elements.length === 0) return
  try {
    const { exportToSvg } = await import('@excalidraw/excalidraw')
    const svg = await exportToSvg({
      elements: props.node.attrs.elements,
      appState: { ...props.node.attrs.appState, exportBackground: false }
    })
    previewRef.value.innerHTML = ''
    previewRef.value.appendChild(svg)
  } catch {
    previewRef.value.innerHTML = '<p>Preview unavailable</p>'
  }
}

onMounted(renderPreview)
watch(() => props.node.attrs.elements, renderPreview, { deep: true })
</script>

<style scoped>
.excalidraw-block__preview {
  border: 1px solid var(--md-sys-color-outline-variant, #ccc);
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  margin: 1rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.excalidraw-block__preview:hover { border-color: #1976D2; }
.excalidraw-block__empty { color: #999; font-style: italic; }
.excalidraw-block__svg { width: 100%; height: 100%; }
.excalidraw-block__svg :deep(svg) { width: 100%; height: 100%; }
</style>
```

- [ ] **Step 5: Create ExcalidrawModal (fullscreen React Excalidraw editor)**

```vue
<!-- ux/src/components/editor/ExcalidrawModal.vue -->
<template>
  <Teleport to="body">
    <div class="excalidraw-modal">
      <div class="excalidraw-modal__header">
        <span>Excalidraw Editor</span>
        <button @click="save">Save & Close</button>
        <button @click="$emit('close')">Cancel</button>
      </div>
      <div class="excalidraw-modal__canvas" ref="canvasRef" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

const props = defineProps({
  elements: { type: Array, default: () => [] },
  appState: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['close', 'save'])

const canvasRef = ref(null)
let reactRoot = null
let currentElements = [...props.elements]
let currentAppState = { ...props.appState }

onMounted(async () => {
  const { Excalidraw } = await import('@excalidraw/excalidraw')
  reactRoot = createRoot(canvasRef.value)
  reactRoot.render(
    createElement(Excalidraw, {
      initialData: { elements: props.elements, appState: props.appState },
      onChange: (elements, appState) => {
        currentElements = elements
        currentAppState = appState
      }
    })
  )
})

onBeforeUnmount(() => {
  if (reactRoot) reactRoot.unmount()
})

function save () {
  emit('save', { elements: currentElements, appState: currentAppState })
}
</script>

<style scoped>
.excalidraw-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: white;
  display: flex;
  flex-direction: column;
}
.excalidraw-modal__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ddd;
}
.excalidraw-modal__header span { flex: 1; font-weight: 600; }
.excalidraw-modal__header button {
  padding: 0.4rem 1rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  cursor: pointer;
}
.excalidraw-modal__canvas { flex: 1; }
</style>
```

- [ ] **Step 6: Run tests**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run __tests__/editor/ExcalidrawExtension.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add ux/src/components/editor/ExcalidrawExtension.js ux/src/components/editor/ExcalidrawNodeView.vue ux/src/components/editor/ExcalidrawModal.vue ux/__tests__/editor/ExcalidrawExtension.test.mjs
git commit -m "feat: add ExcalidrawBlock TipTap extension with fullscreen modal editor"
```

---

### Task 4: Create DiagramToolbarMenu and register extensions in editor

**Files:**
- Create: `ux/src/components/editor/DiagramToolbarMenu.vue`
- Modify: `ux/src/components/EditorWysiwyg.vue`

- [ ] **Step 1: Create toolbar dropdown menu**

```vue
<!-- ux/src/components/editor/DiagramToolbarMenu.vue -->
<template>
  <q-btn-dropdown flat dense icon="mdi-chart-tree" label="Diagram" no-caps>
    <q-list>
      <q-item clickable v-close-popup @click="$emit('insert', 'mermaid')">
        <q-item-section avatar><q-icon name="mdi-code-braces" /></q-item-section>
        <q-item-section>
          <q-item-label>Mermaid</q-item-label>
          <q-item-label caption>Code-based diagrams (flowchart, sequence, etc.)</q-item-label>
        </q-item-section>
      </q-item>
      <q-item clickable v-close-popup @click="$emit('insert', 'excalidraw')">
        <q-item-section avatar><q-icon name="mdi-draw" /></q-item-section>
        <q-item-section>
          <q-item-label>Excalidraw</q-item-label>
          <q-item-label caption>Visual diagrams with drag and drop</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup>
defineEmits(['insert'])
</script>
```

- [ ] **Step 2: Register extensions in EditorWysiwyg.vue**

In `ux/src/components/EditorWysiwyg.vue`, add imports at the top (after existing imports):

```javascript
import { MermaidExtension } from './editor/MermaidExtension.js'
import { ExcalidrawExtension } from './editor/ExcalidrawExtension.js'
import DiagramToolbarMenu from './editor/DiagramToolbarMenu.vue'
```

Add both extensions to the `extensions` array in `useEditor()` (after `Typography` on line 772):

```javascript
      Typography,
      MermaidExtension,
      ExcalidrawExtension
```

Add the toolbar component and insert handler in the template — locate the toolbar section and add:

```vue
<DiagramToolbarMenu @insert="insertDiagram" />
```

Add the insert function:

```javascript
function insertDiagram (type) {
  if (type === 'mermaid') {
    editor.chain().focus().insertContent({ type: 'mermaidBlock' }).run()
  } else if (type === 'excalidraw') {
    editor.chain().focus().insertContent({ type: 'excalidrawBlock' }).run()
  }
}
```

- [ ] **Step 3: Run full UX test suite**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add ux/src/components/editor/DiagramToolbarMenu.vue ux/src/components/EditorWysiwyg.vue
git commit -m "feat: register diagram extensions in editor and add toolbar menu"
```

---

### Task 5: Run full test suite and push

- [ ] **Step 1: Run UX tests**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run server tests**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run`
Expected: All tests pass (no server changes in this plan)

- [ ] **Step 3: Push**

```bash
git push origin main
```
