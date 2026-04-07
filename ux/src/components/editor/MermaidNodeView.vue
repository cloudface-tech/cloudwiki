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

let renderCounter = 0

async function renderDiagram () {
  if (!previewRef.value) return
  const id = `mermaid-preview-${++renderCounter}`
  try {
    const { svg } = await mermaid.render(id, props.node.attrs.code)
    previewRef.value.innerHTML = svg
  } catch {
    previewRef.value.innerHTML = '<p style="color:#b71c1c;font-size:0.85rem">Invalid Mermaid syntax</p>'
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
