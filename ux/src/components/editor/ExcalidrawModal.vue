<template>
  <Teleport to="body">
    <div class="excalidraw-modal">
      <div class="excalidraw-modal__header">
        <span>Excalidraw Editor</span>
        <button class="excalidraw-modal__btn excalidraw-modal__btn--primary" @click="save">Save & Close</button>
        <button class="excalidraw-modal__btn" @click="$emit('close')">Cancel</button>
      </div>
      <div class="excalidraw-modal__canvas" ref="canvasRef">
        <div v-if="loading" class="excalidraw-modal__loading">Loading Excalidraw...</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  elements: { type: Array, default: () => [] },
  appState: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['close', 'save'])

const canvasRef = ref(null)
const loading = ref(true)
let reactRoot = null
let currentElements = [...props.elements]
let currentAppState = { ...props.appState }

onMounted(async () => {
  try {
    const React = await import('react')
    const ReactDOM = await import('react-dom/client')
    const ExcalidrawModule = await import('@excalidraw/excalidraw')
    const Excalidraw = ExcalidrawModule.Excalidraw

    // Excalidraw needs its CSS
    if (!document.getElementById('excalidraw-css')) {
      const link = document.createElement('link')
      link.id = 'excalidraw-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/@excalidraw/excalidraw/dist/browser/dev/index.css'
      document.head.appendChild(link)
    }

    loading.value = false

    reactRoot = ReactDOM.createRoot(canvasRef.value)
    reactRoot.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Excalidraw, {
          initialData: {
            elements: props.elements.length > 0 ? props.elements : undefined,
            appState: { ...props.appState, viewBackgroundColor: '#ffffff' }
          },
          onChange: (elements, appState) => {
            currentElements = [...elements]
            currentAppState = { ...appState }
          }
        })
      )
    )
  } catch (err) {
    console.error('[Excalidraw] Failed to load:', err)
    loading.value = false
    if (canvasRef.value) {
      canvasRef.value.innerHTML = '<p style="padding:2rem;color:red">Failed to load Excalidraw: ' + err.message + '</p>'
    }
  }
})

onBeforeUnmount(() => {
  if (reactRoot) {
    try { reactRoot.unmount() } catch {}
  }
})

function save () {
  emit('save', { elements: currentElements, appState: currentAppState })
}
</script>

<style>
/* Excalidraw needs unscoped styles */
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
  z-index: 10000;
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
.excalidraw-modal__canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.excalidraw-modal__canvas .excalidraw {
  width: 100%;
  height: 100%;
}
.excalidraw-modal__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 1.1rem;
}
</style>
