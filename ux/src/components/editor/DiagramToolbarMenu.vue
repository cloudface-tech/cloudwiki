<template>
  <q-btn flat dense icon="mdi-chart-tree" label="Diagram" no-caps @click="$emit('insert', 'mermaid')" />
</template>

<script setup>
defineEmits(['insert'])
</script>
