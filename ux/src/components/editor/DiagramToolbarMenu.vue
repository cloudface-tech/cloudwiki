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
