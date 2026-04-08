<template lang="pug">
//- Header
q-item-label.sidebar-nav-header(
  v-if='item.type === `header`'
  header
  ) {{ item.label }}

//- Separator
q-separator.sidebar-nav-sep(
  v-else-if='item.type === `separator`'
  )

//- Link with children (recursive)
q-expansion-item.sidebar-nav-expand(
  v-else-if='item.type === `link` && item.children?.length > 0'
  :icon='item.icon'
  :label='item.label'
  :aria-label='item.label'
  dense
  :style='{ paddingLeft: (depth * 8) + "px" }'
  )
  q-list(clickable, dense)
    nav-sidebar-item(
      v-for='child of item.children'
      :key='child.id'
      :item='child'
      :depth='depth + 1'
      )

//- Leaf link
q-item(
  v-else-if='item.type === `link`'
  :to='item.target'
  :aria-label='item.label'
  :aria-current='route.path === item.target ? `page` : undefined'
  :style='{ paddingLeft: (12 + depth * 12) + "px" }'
  )
  q-item-section(v-if='item.icon && depth === 0', side)
    q-icon(:name='item.icon')
  q-item-section.text-wordbreak-all {{ item.label }}
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

defineProps({
  item: { type: Object, required: true },
  depth: { type: Number, default: 0 }
})
</script>
