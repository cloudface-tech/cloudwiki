<template lang='pug'>
q-page.admin-navigation
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-tree-structure.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.navigation.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.navigation.subtitle') }}
    .col-auto
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/admin/navigation`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    //- Left column: item list
    .col-12.col-md-5.col-lg-4
      q-card.bg-dark
        q-card-section.q-pb-none
          .text-subtitle2.text-white {{ t('admin.navigation.items') || 'Menu Items' }}
        q-scroll-area(style='height: calc(100vh - 280px);')
          sortable(
            class='q-list q-list--dense q-list--dark nav-edit-list'
            :list='state.items'
            item-key='id'
            :options='sortableOptions'
            @end='updateItemPosition'
            )
            template(#item='{element}')
              .nav-edit-item.nav-edit-item-header(
                v-if='element.type === `header`'
                :class='state.selected === element.id ? `is-active` : ``'
                @click='setItem(element)'
                )
                q-item-label.text-caption(header) {{ element.label }}
                q-space
                q-item-section(side)
                  q-icon.handle(name='mdi-drag-horizontal', size='sm')
              q-item.nav-edit-item.nav-edit-item-link(
                v-else-if='element.type === `link`'
                :class='{ "is-active": state.selected === element.id, "is-nested": element.isNested }'
                @click='setItem(element)'
                clickable
                )
                q-item-section(side)
                  q-icon(:name='element.icon', color='white')
                q-item-section.text-wordbreak-all {{ element.label }}
                q-item-section(side)
                  q-icon.handle(name='mdi-drag-horizontal', size='sm')
              .nav-edit-item.nav-edit-item-separator(
                v-else
                :class='state.selected === element.id ? `is-active` : ``'
                @click='setItem(element)'
                )
                q-separator(dark, inset, style='flex: 1; margin-top: 11px;')
                q-item-section(side)
                  q-icon.handle(name='mdi-drag-horizontal', size='sm')
        q-card-section
          q-btn.full-width(
            flat
            color='positive'
            :label='t(`common.actions.add`)'
            icon='las la-plus-circle'
            )
            q-menu(fit, :offset='[0, 10]', auto-close)
              q-list(separator)
                q-item(clickable, @click='addItem(`header`)')
                  q-item-section(side)
                    q-icon(name='las la-heading')
                  q-item-section
                    q-item-label {{ t('admin.navigation.header') || 'Header' }}
                q-item(clickable, @click='addItem(`link`)')
                  q-item-section(side)
                    q-icon(name='las la-link')
                  q-item-section
                    q-item-label {{ t('admin.navigation.link') || 'Link' }}
                q-item(clickable, @click='addItem(`separator`)')
                  q-item-section(side)
                    q-icon(name='las la-minus')
                  q-item-section
                    q-item-label {{ t('admin.navigation.separator') || 'Separator' }}

    //- Right column: item editor
    .col-12.col-md-7.col-lg-8
      template(v-if='state.items.length < 1')
        q-card.q-pa-lg.text-center
          q-icon(name='las la-arrow-left', size='md', color='grey')
          .text-grey.q-mt-sm {{ t('admin.navigation.emptyList') || 'No menu items yet. Click Add to create one.' }}

      template(v-else-if='!state.selected')
        q-card.q-pa-lg.text-center
          q-icon(name='las la-mouse-pointer', size='md', color='grey')
          .text-grey.q-mt-sm {{ t('admin.navigation.noSelection') || 'Select an item from the list to edit it.' }}

      //- Header editor
      template(v-if='state.current.type === `header`')
        q-card.q-pb-sm
          q-card-section
            .text-subtitle1 {{ t('admin.navigation.header') || 'Header' }}
          q-item
            q-item-section(side)
              q-icon(name='las la-heading', color='grey')
            q-item-section
              q-item-label Label
            q-item-section
              q-input(
                outlined
                v-model='state.current.label'
                dense
                hide-bottom-space
                )
          q-item
            q-item-section(side)
              q-icon(name='las la-users', color='grey')
            q-item-section
              q-item-label Visibility
            q-item-section(avatar)
              q-btn-toggle(
                v-model='state.current.visibilityLimited'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options='visibilityOptions'
              )
          q-item.items-center(v-if='state.current.visibilityLimited')
            q-space
            q-select(
              style='width: 100%; max-width: calc(50% - 34px);'
              outlined
              v-model='state.current.visibilityGroups'
              :options='state.groups'
              option-value='id'
              option-label='name'
              emit-value
              map-options
              dense
              multiple
              label='Groups'
              )
        q-card.q-pa-md.q-mt-md.flex
          q-space
          q-btn.acrylic-btn(
            flat
            icon='las la-trash-alt'
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click='removeItem(state.current.id)'
          )

      //- Link editor
      template(v-if='state.current.type === `link`')
        q-card.q-pb-sm
          q-card-section
            .text-subtitle1 {{ t('admin.navigation.link') || 'Link' }}
          q-item
            q-item-section(side)
              q-icon(name='las la-heading', color='grey')
            q-item-section
              q-item-label Label
            q-item-section
              q-input(
                outlined
                v-model='state.current.label'
                dense
                hide-bottom-space
                )
          q-separator.q-my-sm(inset)
          q-item
            q-item-section(side)
              q-icon(name='las la-icons', color='grey')
            q-item-section
              q-item-label Icon
              q-item-label(caption) Material Design Icons (mdi-*) or Line Awesome (las la-*)
            q-item-section
              q-input(
                outlined
                v-model='state.current.icon'
                dense
                )
          q-separator.q-my-sm(inset)
          q-item
            q-item-section(side)
              q-icon(name='las la-link', color='grey')
            q-item-section
              q-item-label Target
              q-item-label(caption) Path or URL (e.g. /docs or https://...)
            q-item-section
              q-input(
                outlined
                v-model='state.current.target'
                dense
                hide-bottom-space
                )
          q-separator.q-my-sm(inset)
          q-item(tag='label')
            q-item-section(side)
              q-icon(name='las la-external-link-alt', color='grey')
            q-item-section
              q-item-label Open in new window
            q-item-section(avatar)
              q-toggle(
                v-model='state.current.openInNewWindow'
                color='primary'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                )
          q-separator.q-my-sm(inset)
          q-item
            q-item-section(side)
              q-icon(name='las la-users', color='grey')
            q-item-section
              q-item-label Visibility
            q-item-section(avatar)
              q-btn-toggle(
                v-model='state.current.visibilityLimited'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options='visibilityOptions'
              )
          q-item.items-center(v-if='state.current.visibilityLimited')
            q-space
            q-select(
              style='width: 100%; max-width: calc(50% - 34px);'
              outlined
              v-model='state.current.visibilityGroups'
              :options='state.groups'
              option-value='id'
              option-label='name'
              emit-value
              map-options
              dense
              multiple
              label='Groups'
              )
        q-card.q-pa-md.q-mt-md.flex.items-start
          div
            q-btn.acrylic-btn(
              v-if='state.current.isNested'
              flat
              label='Unnest item'
              icon='mdi-format-indent-decrease'
              color='teal'
              padding='xs md'
              @click='state.current.isNested = false'
            )
            q-btn.acrylic-btn(
              v-else
              flat
              label='Nest under previous link'
              icon='mdi-format-indent-increase'
              color='teal'
              padding='xs md'
              @click='state.current.isNested = true'
            )
          q-space
          q-btn.acrylic-btn(
            flat
            icon='las la-trash-alt'
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click='removeItem(state.current.id)'
          )

      //- Separator editor
      template(v-if='state.current.type === `separator`')
        q-card.q-pb-sm
          q-card-section
            .text-subtitle1 {{ t('admin.navigation.separator') || 'Separator' }}
          q-item
            q-item-section(side)
              q-icon(name='las la-users', color='grey')
            q-item-section
              q-item-label Visibility
            q-item-section(avatar)
              q-btn-toggle(
                v-model='state.current.visibilityLimited'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options='visibilityOptions'
              )
          q-item.items-center(v-if='state.current.visibilityLimited')
            q-space
            q-select(
              style='width: 100%; max-width: calc(50% - 34px);'
              outlined
              v-model='state.current.visibilityGroups'
              :options='state.groups'
              option-value='id'
              option-label='name'
              emit-value
              map-options
              dense
              multiple
              label='Groups'
              )
        q-card.q-pa-md.q-mt-md.flex
          q-space
          q-btn.acrylic-btn(
            flat
            icon='las la-trash-alt'
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click='removeItem(state.current.id)'
          )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep, last, pick } from 'lodash-es'
import { v4 as uuid } from 'uuid'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive, watch } from 'vue'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { Sortable } from 'sortablejs-vue3'

/* global APOLLO_CLIENT */

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.navigation.title')
})

// DATA

const state = reactive({
  loading: 0,
  selected: null,
  items: [],
  current: {},
  groups: []
})

const sortableOptions = {
  handle: '.handle',
  animation: 150
}

const visibilityOptions = [
  { value: false, label: 'All' },
  { value: true, label: 'Restricted' }
]

// METHODS

function setItem (item) {
  state.selected = item.id
  state.current = item
}

function addItem (type) {
  const newItem = {
    id: uuid(),
    type,
    visibilityGroups: [],
    visibilityLimited: false
  }
  switch (type) {
    case 'header': {
      newItem.label = 'New Header'
      break
    }
    case 'link': {
      newItem.label = 'New Link'
      newItem.icon = 'mdi-text-box-outline'
      newItem.target = '/'
      newItem.openInNewWindow = false
      newItem.isNested = false
      break
    }
  }
  state.items.push(newItem)
  state.selected = newItem.id
  state.current = newItem
}

function removeItem (id) {
  state.items = state.items.filter(item => item.id !== id)
  state.selected = null
  state.current = {}
}

function updateItemPosition (ev) {
  const item = state.items.splice(ev.oldIndex, 1)[0]
  state.items.splice(ev.newIndex, 0, item)
}

function cleanMenuItem (item, isNested = false) {
  switch (item.type) {
    case 'header': {
      return {
        ...pick(item, ['id', 'type', 'label']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
    case 'link': {
      return {
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : [],
        ...!isNested && { children: [] }
      }
    }
    case 'separator': {
      return {
        ...pick(item, ['id', 'type']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
  }
}

async function loadGroups () {
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getGroupsForAdminNav {
        groups {
          id
          name
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.groups = cloneDeep(resp?.data?.groups ?? [])
}

async function load () {
  state.loading++
  state.items = []
  state.selected = null
  state.current = {}
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getNavigationForAdmin ($id: UUID!) {
          navigationById (id: $id) {
            id
            type
            label
            icon
            target
            openInNewWindow
            visibilityGroups
            children {
              id
              type
              label
              icon
              target
              openInNewWindow
              visibilityGroups
            }
          }
        }
      `,
      variables: {
        id: adminStore.currentSiteId
      },
      fetchPolicy: 'network-only'
    })
    for (const item of cloneDeep(resp?.data?.navigationById ?? [])) {
      state.items.push({
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow', 'visibilityGroups']),
        visibilityLimited: item.visibilityGroups?.length > 0
      })
      for (const child of (item?.children ?? [])) {
        state.items.push({
          ...pick(child, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow', 'visibilityGroups']),
          visibilityLimited: child.visibilityGroups?.length > 0,
          isNested: true
        })
      }
    }
  } catch (err) {
    console.error(err)
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

async function save () {
  state.loading++
  try {
    const items = []
    for (const item of state.items) {
      if (item.isNested) {
        if (items.length < 1 || last(items)?.type !== 'link') {
          throw new Error('Nested link items must be placed under a parent link.')
        }
        items[items.length - 1].children.push(cleanMenuItem(item, true))
      } else {
        items.push(cleanMenuItem(item))
      }
    }

    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation updateSiteNav (
          $siteId: UUID!
          $items: [NavigationItemInput!]!
        ) {
          updateSiteNavigation (
            siteId: $siteId
            items: $items
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        siteId: adminStore.currentSiteId,
        items
      }
    })
    if (resp?.data?.updateSiteNavigation?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: 'Navigation updated successfully.'
      })
      APOLLO_CLIENT.cache.evict('ROOT_QUERY')
      APOLLO_CLIENT.cache.gc()
    } else {
      throw new Error(resp?.data?.updateSiteNavigation?.operation?.message || 'Unexpected error occurred.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  loadGroups()
  if (adminStore.currentSiteId) {
    load()
  }
})

watch(() => adminStore.currentSiteId, (newVal) => {
  if (newVal) {
    load()
  }
})
</script>

<style lang='scss' scoped>
@use 'sass:color';

.nav-edit-item {
  position: relative;
  &.is-active {
    background-color: $blue-8;
  }

  &.sortable-chosen {
    background-color: $blue-5;
  }
}

.nav-edit-item-header {
  display: flex;
  cursor: pointer;
}

.nav-edit-item-link {
  &.is-nested {
    border-left: 10px solid $dark-1;
    background-color: $dark-4;
    &.is-active {
      background-color: $primary;
    }
  }
}

.nav-edit-item-separator {
  display: flex;
  cursor: pointer;
}

.handle {
  cursor: grab;
}
</style>
