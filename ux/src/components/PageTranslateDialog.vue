<template lang="pug">
q-dialog(ref='dialogRef' @hide='onDialogHide')
  q-card(style='width: 450px; max-width: 90vw;')
    q-toolbar.bg-primary.text-white
      q-icon(name='las la-language' size='24px')
      q-toolbar-title Translate Page
      q-btn(flat round dense icon='las la-times' v-close-popup)

    q-card-section
      p.text-body2.text-grey-7 Create a copy of this page in another language. The new page will be created as a draft for you to review and edit.

      q-select.q-mb-md(
        v-model='state.targetLocale'
        :options='localeOptions'
        outlined dense
        label='Target Language'
        emit-value
        map-options
      )

      q-input(
        v-model='state.targetPath'
        outlined dense
        label='Custom path (optional)'
        :placeholder='defaultPath'
        hint='Leave empty to use default: {locale}/{original-path}'
      )

    q-card-section(v-if='state.result')
      q-banner.bg-positive.text-white.rounded-borders
        template(v-slot:avatar)
          q-icon(name='las la-check-circle')
        | Page created as draft at #[strong /{{ state.result.path }}]
        br
        | Edit and publish when translation is ready.

    q-card-section(v-if='state.error')
      q-banner.bg-negative.text-white.rounded-borders
        | {{ state.error }}

    q-card-actions(align='right')
      q-btn(flat label='Cancel' no-caps v-close-popup)
      q-btn(
        unelevated color='primary'
        label='Translate' no-caps
        icon='las la-language'
        :loading='state.translating'
        :disable='!state.targetLocale || !!state.result'
        @click='translate'
      )
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { usePageStore } from '@/stores/page'

const props = defineProps({
  pageId: { type: String, required: true },
  currentPath: { type: String, default: '' },
  currentLocale: { type: String, default: 'en' }
})

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide } = useDialogPluginComponent()
const pageStore = usePageStore()

const localeOptions = [
  { label: 'English', value: 'en' },
  { label: 'Portugues', value: 'pt' },
  { label: 'Espanol', value: 'es' },
  { label: 'Francais', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Italiano', value: 'it' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' }
].filter(l => l.value !== props.currentLocale)

const state = reactive({
  targetLocale: '',
  targetPath: '',
  translating: false,
  result: null,
  error: null
})

const defaultPath = computed(() => {
  if (!state.targetLocale) return ''
  return `${state.targetLocale}/${props.currentPath}`
})

async function translate () {
  state.translating = true
  state.error = null
  state.result = null
  try {
    const body = {
      pageId: props.pageId,
      targetLocale: state.targetLocale
    }
    if (state.targetPath) body.targetPath = state.targetPath

    const resp = await fetch('/api/mcp/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await resp.json()
    if (resp.ok) {
      state.result = data
    } else {
      state.error = data.error || 'Translation failed'
    }
  } catch (err) {
    state.error = err.message
  } finally {
    state.translating = false
  }
}
</script>
