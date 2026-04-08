<template>
  <!-- Header -->
  <q-item-label v-if="item.type === 'header'" class="sidebar-nav-header" header>
    {{ item.label }}
  </q-item-label>

  <!-- Separator -->
  <q-separator v-else-if="item.type === 'separator'" class="sidebar-nav-sep" />

  <!-- Folder with children (recursive) -->
  <q-expansion-item
    v-else-if="item.type === 'link' && hasChildren"
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
import { computed } from 'vue'

export default {
  name: 'NavSidebarItem',
  props: {
    item: { type: Object, required: true },
    depth: { type: Number, default: 0 }
  },
  setup (props) {
    const route = useRoute()
    const hasChildren = computed(() => props.item.children && props.item.children.length > 0)
    return { route, hasChildren }
  }
}
</script>
