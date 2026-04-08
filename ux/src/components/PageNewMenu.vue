<template lang="pug">
q-menu.translucent-menu(
  auto-close
  anchor='bottom right'
  self='top right'
  )
  q-list(padding)
    q-item(
      clickable
      @click='create(`wysiwyg`)'
      )
      blueprint-icon(icon='google-presentation')
      q-item-section.q-pr-sm New Page
    template(v-if='props.hideAssetBtn === false')
      q-separator.q-my-sm(inset)
      q-item(
        clickable
        @click='openFileManager'
        )
        blueprint-icon(icon='add-image')
        q-item-section.q-pr-sm Upload Media Asset
    template(v-if='props.showNewFolder')
      q-separator.q-my-sm(inset)
      q-item(
        clickable
        @click='newFolder'
        )
        blueprint-icon(icon='add-folder')
        q-item-section.q-pr-sm New Folder
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useFlagsStore } from '@/stores/flags'

// PROPS

const props = defineProps({
  hideAssetBtn: {
    type: Boolean,
    default: false
  },
  showNewFolder: {
    type: Boolean,
    default: false
  },
  basePath: {
    type: String,
    default: null
  }
})

// EMITS

const emit = defineEmits(['newFolder', 'newPage'])

// QUASAR

const $q = useQuasar()

// STORES

const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

async function create (editor) {
  $q.loading.show()
  emit('newPage')
  await pageStore.pageCreate({ editor, basePath: props.basePath })
  $q.loading.hide()
}

function openFileManager () {
  siteStore.openFileManager()
}

function newFolder () {
  emit('newFolder')
}
</script>
