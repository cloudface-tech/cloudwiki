<template lang="pug">
q-dialog(ref='dialogRef' @hide='onDialogHide')
  q-card(style='width: 550px; max-width: 90vw;')
    q-toolbar.bg-primary.text-white
      q-icon(name='las la-lock' size='24px')
      q-toolbar-title Page Permissions
      q-btn(flat round dense icon='las la-times' v-close-popup)

    q-card-section
      //- Existing permissions
      q-list(v-if='state.permissions.length' separator)
        q-item(v-for='perm in state.permissions' :key='perm.id')
          q-item-section(avatar)
            q-icon(:name='perm.subjectType === "user" ? "las la-user" : "las la-users"' color='primary')
          q-item-section
            q-item-label {{ perm.subjectId }}
            q-item-label(caption) {{ perm.subjectType }}
          q-item-section(side)
            .row.items-center
              q-badge(:color='levelColor(perm.level)' :label='perm.level')
              q-btn.q-ml-sm(
                flat round dense
                icon='las la-trash-alt'
                size='sm'
                color='negative'
                @click='removePerm(perm.id)'
              )

      .text-grey-6.text-center.q-py-md(v-else)
        | No custom permissions. Page uses default site permissions.

    q-separator

    q-card-section
      .text-subtitle2.q-mb-sm Add Permission
      .row.q-gutter-sm
        q-select.col(
          v-model='state.newPerm.subjectType'
          :options='subjectTypes'
          outlined dense
          label='Type'
          emit-value
          map-options
        )
        q-input.col-5(
          v-model='state.newPerm.subjectId'
          outlined dense
          label='User or Group ID'
        )
        q-select.col(
          v-model='state.newPerm.level'
          :options='levels'
          outlined dense
          label='Level'
          emit-value
          map-options
        )
      .row.q-mt-sm.justify-end
        q-btn(
          unelevated color='primary'
          label='Add' no-caps
          icon='las la-plus'
          :disable='!state.newPerm.subjectId'
          :loading='state.saving'
          @click='addPerm'
        )
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { usePageStore } from '@/stores/page'

const props = defineProps({
  pageId: { type: String, required: true }
})

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide } = useDialogPluginComponent()
const pageStore = usePageStore()

const subjectTypes = [
  { label: 'User', value: 'user' },
  { label: 'Group', value: 'group' }
]

const levels = [
  { label: 'Read', value: 'read' },
  { label: 'Write', value: 'write' },
  { label: 'Admin', value: 'admin' }
]

const state = reactive({
  permissions: [],
  newPerm: { subjectType: 'user', subjectId: '', level: 'read' },
  saving: false
})

function levelColor (level) {
  return { read: 'blue', write: 'orange', admin: 'red' }[level] || 'grey'
}

async function fetchPerms () {
  try {
    const resp = await fetch(`/api/mcp/pages/${props.pageId}/permissions`)
    if (!resp.ok) return
    const data = await resp.json()
    state.permissions = data.permissions || []
  } catch {}
}

async function addPerm () {
  if (!state.newPerm.subjectId) return
  state.saving = true
  try {
    const resp = await fetch(`/api/mcp/pages/${props.pageId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.newPerm)
    })
    if (resp.ok) {
      state.newPerm.subjectId = ''
      await fetchPerms()
    }
  } finally {
    state.saving = false
  }
}

async function removePerm (id) {
  try {
    const resp = await fetch(`/api/mcp/permissions/${id}`, { method: 'DELETE' })
    if (resp.ok) await fetchPerms()
  } catch {}
}

onMounted(fetchPerms)
</script>
