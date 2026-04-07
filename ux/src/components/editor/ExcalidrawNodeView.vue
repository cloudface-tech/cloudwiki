<template>
  <node-view-wrapper class="excalidraw-block">
    <div
      class="excalidraw-block__preview"
      :style="{ width: node.attrs.width + 'px', minHeight: '200px' }"
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
  background: #fafafa;
}
.excalidraw-block__preview:hover { border-color: #1976D2; }
.excalidraw-block__empty { color: #999; font-style: italic; padding: 2rem; }
.excalidraw-block__svg { width: 100%; height: 100%; }
.excalidraw-block__svg :deep(svg) { width: 100%; height: 100%; }
</style>
