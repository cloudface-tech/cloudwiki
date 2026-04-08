<template>
  <!-- Header -->
  <q-item-label v-if="item.type === 'header'" class="sidebar-nav-header" header>
    {{ item.label }}
  </q-item-label>

  <!-- Separator -->
  <q-separator v-else-if="item.type === 'separator'" class="sidebar-nav-sep" />

  <!-- Folder with children (recursive) -->
  <q-expansion-item
    v-else-if="item.type === 'link' && item.children && item.children.length > 0"
    class="sidebar-nav-expand"
    :icon="item.icon"
    :label="item.label"
    dense
  >
    <q-list clickable dense>
      <nav-sidebar-item
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :depth="depth + 1"
      />
    </q-list>
  </q-expansion-item>

  <!-- Leaf link (page) -->
  <q-item
    v-else-if="item.type === 'link'"
    :to="item.target"
    :aria-label="item.label"
  >
    <q-item-section v-if="item.icon && depth === 0" side>
      <q-icon :name="item.icon" />
    </q-item-section>
    <q-item-section class="text-wordbreak-all">{{ item.label }}</q-item-section>
  </q-item>
</template>

<script>
import { useRoute } from 'vue-router'

export default {
  name: 'NavSidebarItem',
  components: {
    // Self-reference for recursion — Vue resolves by name
  },
  props: {
    item: { type: Object, required: true },
    depth: { type: Number, default: 0 }
  },
  setup () {
    const route = useRoute()
    return { route }
  },
  beforeCreate () {
    // Register self for recursion
    this.$options.components['nav-sidebar-item'] = this.$options
  }
}
</script>
