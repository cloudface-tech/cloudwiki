<template>
  <Teleport to="body">
    <div class="excalidraw-modal">
      <div class="excalidraw-modal__header">
        <span>Excalidraw Editor</span>
        <button class="excalidraw-modal__btn excalidraw-modal__btn--primary" @click="save">Save & Close</button>
        <button class="excalidraw-modal__btn" @click="$emit('close')">Cancel</button>
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
  background: #f5f5f5;
}
.excalidraw-modal__header span { flex: 1; font-weight: 600; font-size: 1rem; }
.excalidraw-modal__btn {
  padding: 0.4rem 1rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  cursor: pointer;
  background: white;
  font-size: 0.85rem;
}
.excalidraw-modal__btn--primary {
  background: #1976D2;
  color: white;
  border-color: #1976D2;
}
.excalidraw-modal__canvas { flex: 1; }
</style>
