<template lang="pug">
q-dialog(ref='dialogRef' @hide='onDialogHide')
  q-card(style='width: 600px; max-width: 90vw;')
    q-toolbar.bg-primary.text-white
      q-icon(name='las la-copy' size='24px')
      q-toolbar-title Create from Template
      q-btn(flat round dense icon='las la-times' v-close-popup)

    q-card-section
      q-input.q-mb-md(
        v-model='state.search'
        outlined dense
        placeholder='Search templates...'
        clearable
      )
        template(v-slot:prepend)
          q-icon(name='las la-search')

      .text-grey-6.text-center.q-py-lg(v-if='state.loading')
        q-spinner(color='primary' size='32px')
        .q-mt-sm Loading templates...

      .text-grey-6.text-center.q-py-lg(v-else-if='!filteredTemplates.length')
        q-icon(name='las la-file-alt' size='48px' color='grey-4')
        .q-mt-sm No templates found.
        .text-caption Tag a page with "template" or place it under templates/ path.

      q-list(v-else separator)
        q-item(
          v-for='tpl in filteredTemplates'
          :key='tpl.id'
          clickable
          v-ripple
          @click='selectTemplate(tpl)'
          :active='state.selectedId === tpl.id'
          active-class='bg-blue-1'
        )
          q-item-section(avatar)
            q-icon(:name='tpl.icon || "las la-file-alt"' color='primary')
          q-item-section
            q-item-label {{ tpl.title }}
            q-item-label(caption) /{{ tpl.path }}
          q-item-section(side v-if='state.selectedId === tpl.id')
            q-icon(name='las la-check' color='primary')

    q-separator(v-if='state.selectedId')

    q-card-section(v-if='state.selectedId')
      .text-subtitle2.q-mb-sm New Page Details
      q-input.q-mb-sm(
        v-model='state.newTitle'
        outlined dense
        label='Page Title'
      )
      q-input.q-mb-sm(
        v-model='state.newPath'
        outlined dense
        label='Page Path'
        hint='e.g. docs/my-new-page'
      )
      q-input(
        v-model='state.newDescription'
        outlined dense
        label='Description (optional)'
      )

    q-card-actions(align='right')
      q-btn(flat label='Blank Page' no-caps @click='createBlank' icon='las la-file')
      q-btn(
        unelevated color='primary'
        label='Create from Template' no-caps
        icon='las la-copy'
        :loading='state.creating'
        :disable='!state.selectedId || !state.newTitle || !state.newPath'
        @click='createFromTemplate'
      )
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

const emit = defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent()
const $q = useQuasar()
const router = useRouter()

const state = reactive({
  templates: [],
  loading: true,
  search: '',
  selectedId: null,
  newTitle: '',
  newPath: '',
  newDescription: '',
  creating: false
})

const filteredTemplates = computed(() => {
  if (!state.search) return state.templates
  const q = state.search.toLowerCase()
  return state.templates.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.path.toLowerCase().includes(q)
  )
})

async function fetchTemplates () {
  state.loading = true
  try {
    const resp = await fetch('/api/mcp/templates')
    if (resp.ok) {
      const data = await resp.json()
      state.templates = data.templates || []
    }
  } finally {
    state.loading = false
  }
}

function selectTemplate (tpl) {
  state.selectedId = tpl.id
  if (!state.newTitle) state.newTitle = `New ${tpl.title}`
}

function createBlank () {
  onDialogOK({ blank: true })
}

async function createFromTemplate () {
  if (!state.selectedId || !state.newTitle || !state.newPath) return
  state.creating = true
  try {
    const resp = await fetch(`/api/mcp/templates/${state.selectedId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: state.newTitle,
        path: state.newPath,
        description: state.newDescription
      })
    })
    const data = await resp.json()
    if (resp.ok) {
      $q.notify({ type: 'positive', message: `Page created at /${data.path}` })
      onDialogOK({ created: true, path: data.path })
      router.push(`/${data.path}`)
    } else {
      $q.notify({ type: 'negative', message: data.error || 'Failed to create page' })
    }
  } finally {
    state.creating = false
  }
}

onMounted(fetchTemplates)
</script>
