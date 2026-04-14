<template lang="pug">
.page-toc(v-if='tocItems.length > 1')
  .page-toc-title Nesta pagina
  .page-toc-list
    a.page-toc-item(
      v-for='item in tocItems'
      :key='item.id'
      :href='`#${item.id}`'
      :class='`page-toc-level-${item.level}`'
      @click.prevent='scrollTo(item.id)'
    ) {{ item.text }}
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { usePageStore } from '@/stores/page'

const pageStore = usePageStore()

const tocItems = computed(() => {
  const html = pageStore.render || ''
  if (!html) return []
  const regex = /<h([1-4])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi
  const items = []
  let match
  while ((match = regex.exec(html)) !== null) {
    items.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, '').trim()
    })
  }
  // Fallback: extract from rendered DOM
  if (items.length === 0 && typeof document !== 'undefined') {
    const container = document.querySelector('.page-contents')
    if (container) {
      container.querySelectorAll('h1, h2, h3, h4').forEach((el, idx) => {
        if (!el.id) el.id = `heading-${idx}`
        items.push({
          level: parseInt(el.tagName[1]),
          id: el.id,
          text: el.textContent.trim()
        })
      })
    }
  }
  return items
})

function scrollTo (id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style lang="scss">
.page-toc {
  position: sticky;
  top: 80px;
  width: 220px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 16px;
  margin-left: 16px;
  flex-shrink: 0;

  @media (max-width: 1200px) {
    display: none;
  }
}

.page-toc-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94A3B8;
  margin-bottom: 8px;
}

.page-toc-item {
  display: block;
  font-size: 0.8rem;
  line-height: 1.4;
  padding: 3px 0;
  color: #64748B;
  text-decoration: none;
  border-left: 2px solid transparent;
  transition: all 0.15s;

  &:hover {
    color: #006FEE;
    border-left-color: #006FEE;
  }
}

.page-toc-level-1 { padding-left: 8px; font-weight: 500; }
.page-toc-level-2 { padding-left: 16px; }
.page-toc-level-3 { padding-left: 24px; font-size: 0.75rem; }
.page-toc-level-4 { padding-left: 32px; font-size: 0.75rem; color: #94A3B8; }

@at-root .body--dark {
  .page-toc-item {
    color: #9CA3AF;
    &:hover { color: #5BA7FF; border-left-color: #5BA7FF; }
  }
}
</style>
