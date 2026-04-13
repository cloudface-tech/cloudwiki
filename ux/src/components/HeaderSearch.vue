<template lang="pug">
q-toolbar(
  style='height: 64px;'
  dark
  v-if='siteStore.features.search'
  )
  q-input(
    dark
    v-model='siteStore.search'
    standout='bg-white text-dark'
    dense
    rounded
    ref='searchField'
    style='width: 100%;'
    label='Search...'
    @keyup.enter='onSearchEnter'
    @focus='state.searchIsFocused = true'
    @blur='checkSearchFocus'
    )
    template(v-slot:prepend)
      q-circular-progress.q-mr-xs(
        v-if='(siteStore.searchIsLoading || state.askLoading) && route.path !== `/_search`'
        instant-feedback
        indeterminate
        rounded
        color='primary'
        size='20px'
        )
      q-icon(v-else-if='state.askMode' name='las la-robot' color='amber' @click='toggleAskMode')
      q-icon(v-else name='las la-search' @click='toggleAskMode')
    template(v-slot:append)
      q-toggle.q-mr-xs(
        v-model='state.askMode'
        icon='las la-robot'
        color='amber'
        size='xs'
        dense
        )
        q-tooltip Ask AI
      q-badge.search-kbdbadge.q-mr-sm(
        v-if='!state.searchIsFocused'
        label='Ctrl+K'
        color='custom-color'
        outline
        @click='searchField.focus()'
        )
      q-badge.q-mr-sm(
        v-else-if='state.askMode && siteStore.search'
        label='Enter = Ask AI'
        color='amber-8'
        outline
        )
      q-badge.q-mr-sm(
        v-else-if='siteStore.search && siteStore.search !== siteStore.searchLastQuery'
        label='Press Enter'
        color='grey-7'
        outline
        @click='searchField.focus()'
        )
      q-icon.cursor-pointer(
        name='las la-times'
        size='20px'
        @click='clearSearch'
        v-if='siteStore.search.length > 0'
        color='grey-6'
        )
  //- AI Ask Results
  .searchpanel.searchpanel--ai(
    ref='searchPanel'
    v-if='state.askResults.length > 0'
    )
    .searchpanel-header
      q-icon.q-mr-xs(name='las la-robot' color='amber')
      span AI Results ({{ state.askResults.length }})
      q-badge.q-ml-sm(:label='state.askMethod' color='grey-7' outline)
      q-space
      q-btn.acrylic-btn(flat label='Clear' rounded size='xs' @click='state.askResults = []')
    q-list(dense dark)
      q-item(
        v-for='r in state.askResults'
        :key='r.id'
        clickable
        @click='goToPage(r.path)'
        )
        q-item-section(avatar)
          q-circular-progress(
            :value='r.score * 100'
            size='32px'
            :thickness='0.2'
            color='amber'
            track-color='grey-8'
            font-size='9px'
            show-value
            )
            | {{ Math.round(r.score * 100) }}
        q-item-section
          q-item-label.text-white {{ r.title }}
          q-item-label.text-grey-5(caption lines='2') {{ r.excerpt }}
        q-item-section(side)
          q-item-label.text-grey-6(caption) /{{ r.path }}

  //- Regular search panel
  .searchpanel(
    ref='searchPanel'
    v-if='searchPanelIsShown && !state.askMode'
    )
    template(v-if='siteStore.tagsLoaded && siteStore.tags.length > 0')
      .searchpanel-header
        span Popular Tags
        q-space
        q-btn.acrylic-btn(
          flat
          label='View All'
          rounded
          size='xs'
        )
      .flex.q-mb-md
        q-chip(
          v-for='tag of popularTags'
          :key='tag'
          square
          color='grey-8'
          text-color='white'
          icon='las la-hashtag'
          size='sm'
          clickable
          @click='addTag(tag)'
          ) {{ tag }}
    .searchpanel-header Search Operators
    .searchpanel-tip #[code !foo] or #[code -bar] to exclude "foo" and "bar".
    .searchpanel-tip #[code bana*] for to match any term starting with "bana" (e.g. banana).
    .searchpanel-tip #[code foo,bar] or #[code foo|bar] to search for "foo" OR "bar".
    .searchpanel-tip #[code "foo bar"] to match exactly the phrase "foo bar".
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { orderBy } from 'lodash-es'

import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  searchIsFocused: false,
  askMode: false,
  askLoading: false,
  askResults: [],
  askMethod: ''
})

const searchPanel = ref(null)
const searchField = ref(null)

// COMPUTED

const searchPanelIsShown = computed(() => {
  return state.searchIsFocused && (siteStore.search !== siteStore.searchLastQuery || siteStore.search === '')
})

const popularTags = computed(() => {
  return orderBy(siteStore.tags, ['usageCount', 'desc']).map(t => t.tag)
})

// WATCHERS

watch(searchPanelIsShown, (newValue) => {
  if (newValue) {
    siteStore.fetchTags()
  }
})

// METHODS

function handleKeyPress (ev) {
  if (siteStore.features.search) {
    if (ev.ctrlKey && ev.key === 'k') {
      ev.preventDefault()
      searchField.value.focus()
    }
  }
}

function onSearchEnter () {
  if (!siteStore.search) { return }
  if (state.askMode) {
    askWiki()
    return
  }
  if (route.path === '/_search') {
    router.replace({ path: '/_search', query: { q: siteStore.search } })
  } else {
    siteStore.searchIsLoading = true
    router.push({ path: '/_search', query: { q: siteStore.search } })
  }
}

async function askWiki () {
  if (!siteStore.search) return
  state.askLoading = true
  state.askResults = []
  try {
    const resp = await fetch('/api/mcp/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: siteStore.search, limit: 8 })
    })
    if (resp.ok) {
      const data = await resp.json()
      state.askResults = data.results || []
      state.askMethod = data.method || 'keyword'
    }
  } finally {
    state.askLoading = false
  }
}

function toggleAskMode () {
  state.askMode = !state.askMode
  state.askResults = []
}

function clearSearch () {
  siteStore.search = ''
  state.askResults = []
}

function goToPage (path) {
  state.askResults = []
  state.searchIsFocused = false
  router.push(`/${path}`)
}

function checkSearchFocus (ev) {
  if (!searchPanel.value?.contains(ev.relatedTarget)) {
    state.searchIsFocused = false
  }
}

function addTag (tag) {
  if (!siteStore.search.includes(`#${tag}`)) {
    siteStore.search = siteStore.search ? `${siteStore.search} #${tag}` : `#${tag}`
  }
  searchField.value.focus()
}

// MOUNTED

onMounted(() => {
  if (!import.meta.env.SSR) {
    window.addEventListener('keydown', handleKeyPress)
  }
  if (route.path.startsWith('/_search')) {
    searchField.value.focus()
  }
})
onBeforeUnmount(() => {
  if (!import.meta.env.SSR) {
    window.removeEventListener('keydown', handleKeyPress)
  }
})

</script>

<style lang="scss">
.searchpanel {
  position: absolute;
  top: 64px;
  left: 0;
  background-color: rgba(0,0,0,.7);
  border-radius: 0 0 12px 12px;
  color: #FFF;
  padding: .5rem 1rem 1rem;
  width: 100%;
  backdrop-filter: blur(7px) saturate(180%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(0, 0, 0, 0.14), 0 2px 1px -1px rgba(0, 0, 0, 0.12);

  &-header {
    font-weight: 500;
    border-bottom: 1px solid rgba(255,255,255,.2);
    padding: 0 0 .5rem 0;
    margin-bottom: .5rem;
    display: flex;
    align-items: center;
  }

  &-tip {
    + .searchpanel-tip {
      margin-top: .5rem;
    }
  }

  code {
    background-color: rgba(0,0,0,.7);
    padding: 2px 8px;
    font-weight: 700;
    border-radius: 4px;
  }
}

.search-kbdbadge {
  color: rgba(255,255,255,.5);
}

.searchpanel--ai {
  max-height: 400px;
  overflow-y: auto;

  .q-item {
    border-radius: 8px;
    margin: 2px 0;
    &:hover { background: rgba(255,255,255,.1); }
  }
}
</style>
