<template lang='pug'>
q-page.column
  page-header
  .page-container.row.no-wrap.items-stretch(style='flex: 1 1 100%;')
    .col
      q-no-ssr(v-if='editorStore.isActive')
        component(:is='editorComponents[editorStore.editor]')
      .page-content-wrap(v-else)
        .page-contents(ref='pageContents', v-html='sanitizedRender')
        template(v-if='pageStore.relations && pageStore.relations.length > 0')
          .page-relations
            q-btn.q-mr-sm.q-mb-sm(
              v-for='rel of pageStore.relations'
              :key='`rel-` + rel.id'
              padding='sm md'
              outline
              :icon='rel.icon'
              :label='rel.label'
              no-caps
              color='primary'
              size='sm'
              )
        page-comments-panel(v-if='pageStore.id && !editorStore.isActive')
    //- TOC sidebar (read mode only)
    page-toc(v-if='!editorStore.isActive')
    //- Edit actions (only in editor mode)
    page-actions-col(v-if='editorStore.isActive')
  side-dialog
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import LoadingGeneric from '@/components/LoadingGeneric.vue'
import PageActionsCol from '@/components/PageActionsCol.vue'
import { sanitizeHtml } from '@/helpers/sanitize'
import PageCommentsPanel from '@/components/PageCommentsPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageToc from '@/components/PageToc.vue'
import SideDialog from '@/components/SideDialog.vue'

const milkdownEditor = defineAsyncComponent({
  loader: () => import('../components/EditorMilkdown.vue'),
  loadingComponent: LoadingGeneric
})

const editorComponents = {
  markdown: milkdownEditor,
  wysiwyg: milkdownEditor
}

const $q = useQuasar()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

useMeta({ title: pageStore.title })

const sanitizedRender = computed(() => sanitizeHtml(pageStore.render))

const pageContents = ref(null)

watch(() => route.path, async (newValue) => {
  if (editorStore.ignoreRouteChange) {
    editorStore.$patch({ ignoreRouteChange: false })
    return
  }

  if (newValue.startsWith('/_create')) {
    if (!route.params.editor) {
      $q.notify({ type: 'negative', message: 'No editor specified!' })
      return router.replace('/')
    }
    $q.loading.show()
    const pageCreateArgs = { editor: route.params.editor, fromNavigate: true }
    if (route.query.path) { pageCreateArgs.path = route.query.path }
    if (route.query.locale) { pageCreateArgs.locale = route.query.locale }
    await pageStore.pageCreate(pageCreateArgs)
    $q.loading.hide()
    return
  }

  if (newValue.startsWith('/_edit')) {
    if (!route.params.pagePath) { return router.replace('/') }
    $q.loading.show()
    await pageStore.pageEdit({ path: route.params.pagePath, fromNavigate: true })
    $q.loading.hide()
    return
  }

  if (newValue.startsWith('/_')) { return }

  try {
    await pageStore.pageLoad({ path: newValue })
    if (editorStore.isActive) { editorStore.$patch({ isActive: false }) }
    nextTick(async () => {
      if (pageContents.value) {
        for (const block of pageContents.value.querySelectorAll(':not(:defined)')) {
          commonStore.loadBlocks([block.tagName.toLowerCase()])
        }
        // Render Mermaid diagrams
        const mermaidBlocks = pageContents.value.querySelectorAll('pre.codeblock-mermaid')
        if (mermaidBlocks.length > 0) {
          const mermaid = (await import('mermaid')).default
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
          for (const [idx, block] of mermaidBlocks.entries()) {
            const code = block.querySelector('code')?.textContent || ''
            if (!code.trim()) continue
            try {
              const { svg } = await mermaid.render(`mermaid-page-${idx}`, code)
              const wrapper = document.createElement('div')
              wrapper.className = 'mermaid-rendered'
              wrapper.innerHTML = svg
              block.replaceWith(wrapper)
            } catch {
              // Leave as code block if syntax is invalid
            }
          }
        }
      }
    })
  } catch (err) {
    if (err.message === 'ERR_PAGE_NOT_FOUND') {
      if (newValue === '/') {
        if (!userStore.authenticated) {
          router.push('/login')
        } else if (!userStore.can('write:pages')) {
          router.replace('/_error/unauthorized')
        } else {
          siteStore.overlay = 'Welcome'
        }
      } else {
        $q.notify({ type: 'negative', message: 'This page does not exist (yet)!' })
      }
    } else {
      $q.notify({ type: 'negative', message: err.message })
    }
  }
}, { immediate: true })
</script>

<style lang="scss">
.page-content-wrap {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 32px 48px;
  width: 100%;

  .page-container-scrl > .q-scrollarea__container > .q-scrollarea__content {
    width: 100%;
  }
}

.page-relations {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #E2E8F0;
}

.page-container {
  border-top: none;
}

.q-card {
  @at-root .body--light & { background-color: #FFF; }
  @at-root .body--dark & { background-color: $dark-3; }
}
</style>
