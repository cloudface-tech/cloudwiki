<template>
  <nav class="sidebar-nav-wrapper" role="navigation">
    <q-scroll-area class="sidebar-nav" :thumb-style="thumbStyle" :bar-style="barStyle">
      <q-list class="sidebar-nav-list" clickable dense>
        <template v-for="(item, idx) of allItems" :key="idx">
          <q-item
            v-if="item.type === 'folder' && visible[idx]"
            clickable
            :style="{ paddingLeft: (12 + item.depth * 16) + 'px' }"
            class="sidebar-nav-folder"
            @click="toggle(idx)"
          >
            <q-item-section side>
              <q-icon :name="open[idx] ? 'las la-angle-down' : 'las la-angle-right'" size="14px" />
            </q-item-section>
            <q-item-section class="text-wordbreak-all text-weight-medium">
              {{ item.label }}
            </q-item-section>
          </q-item>

          <q-item
            v-else-if="item.type === 'link' && visible[idx]"
            :to="item.target"
            :style="{ paddingLeft: (28 + item.depth * 16) + 'px' }"
          >
            <q-item-section class="text-wordbreak-all">
              {{ item.label }}
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </q-scroll-area>
  </nav>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

const pageStore = usePageStore()
const siteStore = useSiteStore()
const { t } = useI18n()

const open = ref({})

const thumbStyle = { right: '2px', borderRadius: '3px', backgroundColor: '#CBD5E1', width: '4px', opacity: 0.6 }
const barStyle = { backgroundColor: 'transparent', width: '8px', opacity: 0.1 }

const allItems = computed(() => siteStore.nav.items || [])

function toggle (idx) {
  open.value = { ...open.value, [idx]: !open.value[idx] }
}

// For each item, find its parent folder index (closest preceding folder with depth - 1)
const parentIdx = computed(() => {
  const items = allItems.value
  const map = {}
  for (let i = 0; i < items.length; i++) {
    if (items[i].depth === 0) {
      map[i] = -1
      continue
    }
    for (let j = i - 1; j >= 0; j--) {
      if (items[j].type === 'folder' && items[j].depth === items[i].depth - 1) {
        map[i] = j
        break
      }
    }
    if (map[i] === undefined) map[i] = -1
  }
  return map
})

const visible = computed(() => {
  const items = allItems.value
  const pMap = parentIdx.value
  const result = {}
  for (let i = 0; i < items.length; i++) {
    if (items[i].depth === 0) {
      result[i] = true
    } else {
      const pi = pMap[i]
      if (pi === -1) {
        result[i] = false
      } else {
        result[i] = !!open.value[pi] && !!result[pi]
      }
    }
  }
  return result
})

watch(() => pageStore.navigationId, (newValue) => {
  if (newValue && newValue !== siteStore.nav.currentId) {
    siteStore.fetchNavigation(newValue)
  }
}, { immediate: true })
</script>

<style lang="scss">
.sidebar-nav-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.sidebar-nav {
  height: 100%;

  &-folder {
    color: #475569;
    font-size: 0.825rem;
    min-height: 32px;
    .q-icon { font-size: 14px; color: #94A3B8; }
    &:hover { background: #F1F5F9; color: #1E293B; }
  }

  .q-list > .q-item {
    padding: 4px 12px;
    margin: 1px 8px;
    border-radius: 6px;
    min-height: 32px;
    color: #334155;
    font-size: 0.825rem;
    &:hover { background: #F1F5F9; color: #1E293B; }
    &.q-router-link--active {
      background: #E6F1FE !important;
      color: #006FEE !important;
      font-weight: 600;
    }
  }
}
</style>
