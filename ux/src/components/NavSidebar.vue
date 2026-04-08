<template>
  <nav class="sidebar-nav-wrapper" role="navigation">
    <q-scroll-area class="sidebar-nav" :thumb-style="thumbStyle" :bar-style="barStyle">
      <q-list class="sidebar-nav-list" clickable dense>
        <template v-for="(item, idx) of siteStore.nav.items" :key="item.id || idx">
          <!-- Folder -->
          <q-item
            v-if="item.type === 'folder'"
            v-show="isVisible(item, idx)"
            clickable
            :style="{ paddingLeft: (12 + item.depth * 16) + 'px' }"
            class="sidebar-nav-folder"
            @click="toggleFolder(idx)"
          >
            <q-item-section side>
              <q-icon :name="expanded[idx] ? 'las la-angle-down' : 'las la-angle-right'" size="14px" />
            </q-item-section>
            <q-item-section class="text-wordbreak-all text-weight-medium">
              {{ item.label }}
            </q-item-section>
          </q-item>

          <!-- Page link -->
          <q-item
            v-else-if="item.type === 'link'"
            v-show="isVisible(item, idx)"
            :to="item.target"
            :style="{ paddingLeft: (12 + item.depth * 16) + 'px' }"
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
import { reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

const pageStore = usePageStore()
const siteStore = useSiteStore()
const route = useRoute()
const { t } = useI18n()

const expanded = reactive({})

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

function toggleFolder (idx) {
  expanded[idx] = !expanded[idx]
}

function isVisible (item, idx) {
  // Items at depth 0 are always visible
  if (item.depth === 0) return true

  // Find parent folder — walk backwards to find closest folder with depth = item.depth - 1
  const items = siteStore.nav.items
  for (let i = idx - 1; i >= 0; i--) {
    if (items[i].depth < item.depth) {
      // This is the parent
      if (items[i].type === 'folder') {
        return expanded[i] && isVisible(items[i], i)
      }
      return false
    }
  }
  return true
}

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
    color: #64748B;
    font-size: 0.825rem;
    min-height: 32px;

    .q-icon {
      font-size: 14px;
      color: #94A3B8;
    }

    &:hover {
      background: #F1F5F9;
      color: #334155;
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
