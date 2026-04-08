<template>
  <nav class="sidebar-nav-wrapper" role="navigation">
    <q-scroll-area class="sidebar-nav" :thumb-style="thumbStyle" :bar-style="barStyle">
      <q-list class="sidebar-nav-list" clickable dense>
        <template v-for="(item, idx) of navItems" :key="item.id || idx">
          <!-- Folder -->
          <q-item
            v-if="item.type === 'folder'"
            clickable
            :style="{ paddingLeft: (12 + item.depth * 16) + 'px' }"
            class="sidebar-nav-folder"
            @click="toggleFolder(item.id)"
          >
            <q-item-section side>
              <q-icon :name="expandedFolders[item.id] ? 'las la-angle-down' : 'las la-angle-right'" size="14px" />
            </q-item-section>
            <q-item-section class="text-wordbreak-all text-weight-medium">
              {{ item.label }}
            </q-item-section>
          </q-item>

          <!-- Page link -->
          <q-item
            v-else-if="item.type === 'link'"
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
import { reactive, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

const pageStore = usePageStore()
const siteStore = useSiteStore()
const route = useRoute()
const { t } = useI18n()

const expandedFolders = reactive({})

const thumbStyle = {
  right: '2px',
  borderRadius: '3px',
  backgroundColor: '#CBD5E1',
  width: '4px',
  opacity: 0.6
}
const barStyle = {
  backgroundColor: 'transparent',
  width: '8px',
  opacity: 0.1
}

function toggleFolder (folderId) {
  expandedFolders[folderId] = !expandedFolders[folderId]
}

// Build a map of folder ID -> parent folder ID for visibility checks
const folderParentMap = computed(() => {
  const map = {}
  const items = siteStore.nav.items || []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.depth === 0) continue
    // Walk backwards to find parent folder
    for (let j = i - 1; j >= 0; j--) {
      if (items[j].type === 'folder' && items[j].depth === item.depth - 1) {
        map[item.id] = items[j].id
        break
      }
    }
  }
  return map
})

function isFolderExpanded (folderId) {
  return !!expandedFolders[folderId]
}

function isItemVisible (item) {
  if (item.depth === 0) return true
  // Check all ancestor folders are expanded
  const parentId = folderParentMap.value[item.id]
  if (!parentId) return false
  if (!isFolderExpanded(parentId)) return false
  // Check parent is also visible (recursive)
  const items = siteStore.nav.items || []
  const parentItem = items.find(i => i.id === parentId)
  if (parentItem && parentItem.depth > 0) {
    return isItemVisible(parentItem)
  }
  return true
}

// Filtered visible items
const navItems = computed(() => {
  return (siteStore.nav.items || []).filter(item => isItemVisible(item))
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

    .q-icon {
      font-size: 14px;
      color: #94A3B8;
    }

    &:hover {
      background: #F1F5F9;
      color: #1E293B;
    }
  }

  .q-list > .q-item {
    padding: 4px 12px;
    margin: 1px 8px;
    border-radius: 6px;
    min-height: 32px;
    color: #334155;
    font-size: 0.825rem;

    &:hover {
      background: #F1F5F9;
      color: #1E293B;
    }

    &.q-router-link--active {
      background: #E6F1FE !important;
      color: #006FEE !important;
      font-weight: 600;
    }
  }
}
</style>
