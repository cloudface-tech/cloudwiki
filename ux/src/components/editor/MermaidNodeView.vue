<template>
  <node-view-wrapper class="mermaid-block">
    <div class="mermaid-block__header">
      <span class="mermaid-block__badge">Mermaid</span>
      <button class="mermaid-block__toggle" @click="showCode = !showCode">
        {{ showCode ? 'Hide Code' : 'Edit Code' }}
      </button>
    </div>
    <div class="mermaid-block__container" :class="{ 'mermaid-block__container--split': showCode }">
      <div v-if="showCode" class="mermaid-block__editor">
        <div class="mermaid-block__editor-label">Markdown</div>
        <textarea
          :value="node.attrs.code"
          @input="onInput($event.target.value)"
          spellcheck="false"
          placeholder="flowchart TD&#10;  A --> B"
        />
      </div>
      <div class="mermaid-block__preview" :class="{ 'mermaid-block__preview--full': !showCode }">
        <div v-if="showCode" class="mermaid-block__preview-label">Preview</div>
        <div ref="previewRef" class="mermaid-block__preview-content" />
      </div>
    </div>
  </node-view-wrapper>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import mermaid from 'mermaid'

const props = defineProps(nodeViewProps)
const previewRef = ref(null)
const showCode = ref(true)

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })

let debounceTimer = null

function onInput (value) {
  props.updateAttributes({ code: value })
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(renderDiagram, 300)
}

let renderCounter = 0

async function renderDiagram () {
  if (!previewRef.value) return
  const code = props.node.attrs.code
  if (!code || !code.trim()) {
    previewRef.value.innerHTML = '<p class="mermaid-block__placeholder">Type Mermaid code to see the diagram</p>'
    return
  }
  const id = `mermaid-${++renderCounter}`
  try {
    const { svg } = await mermaid.render(id, code)
    previewRef.value.innerHTML = svg
  } catch {
    previewRef.value.innerHTML = '<p class="mermaid-block__error">Syntax error — check your Mermaid code</p>'
  }
}

onMounted(renderDiagram)
watch(() => props.node.attrs.code, renderDiagram)
</script>

<style scoped>
.mermaid-block__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0 0;
}
.mermaid-block__badge {
  background: #1976D2;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 4px;
}
.mermaid-block__toggle {
  font-size: 0.75rem;
  color: #64748B;
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}
.mermaid-block__toggle:hover { background: #f1f5f9; }

.mermaid-block__container {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin: 0.5rem 0 1rem;
  overflow: hidden;
}
.mermaid-block__container--split {
  display: flex;
}

.mermaid-block__editor {
  flex: 1;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}
.mermaid-block__editor-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  padding: 8px 12px 4px;
  background: #f8fafc;
}
.mermaid-block__editor textarea {
  flex: 1;
  width: 100%;
  min-height: 150px;
  font-family: 'IBM Plex Mono', 'Roboto Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  border: none;
  padding: 8px 12px;
  resize: vertical;
  background: #f8fafc;
  color: #1e293b;
}
.mermaid-block__editor textarea:focus { outline: none; background: #fff; }

.mermaid-block__preview {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.mermaid-block__preview--full {
  width: 100%;
}
.mermaid-block__preview-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  padding: 8px 12px 4px;
}
.mermaid-block__preview-content {
  flex: 1;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}
.mermaid-block__preview-content :deep(svg) {
  max-width: 100%;
  height: auto;
}
.mermaid-block__placeholder {
  color: #94a3b8;
  font-style: italic;
  font-size: 0.85rem;
}
.mermaid-block__error {
  color: #dc2626;
  font-size: 0.8rem;
  padding: 0.5rem;
  background: #fef2f2;
  border-radius: 4px;
}
</style>
