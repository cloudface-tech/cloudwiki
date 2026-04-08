<template>
  <Teleport to="body">
    <div class="excalidraw-modal">
      <div class="excalidraw-modal__header">
        <span>Excalidraw Editor</span>
        <button class="excalidraw-modal__btn excalidraw-modal__btn--primary" @click="save">Save & Close</button>
        <button class="excalidraw-modal__btn" @click="$emit('close')">Cancel</button>
      </div>
      <iframe
        ref="iframeRef"
        src="https://excalidraw.com"
        class="excalidraw-modal__frame"
        allow="clipboard-read; clipboard-write"
      />
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

const iframeRef = ref(null)

function onMessage (event) {
  if (event.origin !== 'https://excalidraw.com') return
  // Excalidraw posts state changes via postMessage when integrated
}

onMounted(() => {
  window.addEventListener('message', onMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
})

function save () {
  // For now, emit close — full bidirectional sync requires Excalidraw's embed API
  // Users can export from Excalidraw and paste as image
  emit('close')
}
</script>

<style>
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
.excalidraw-modal__frame {
  flex: 1;
  border: none;
  width: 100%;
}
</style>
