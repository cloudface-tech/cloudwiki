<template lang="pug">
.milkdown-editor-container
  //- Toolbar
  .milkdown-toolbar(v-if='!state.sourceMode')
    q-btn-group(flat)
      q-btn(flat icon='mdi-format-bold' padding='xs' @click='runCommand("toggleStrong")' :color='state.marks.strong ? "primary" : "grey-10"')
      q-btn(flat icon='mdi-format-italic' padding='xs' @click='runCommand("toggleEmphasis")' :color='state.marks.emphasis ? "primary" : "grey-10"')
      q-btn(flat icon='mdi-format-strikethrough' padding='xs' @click='runCommand("toggleStrikethrough")' :color='state.marks.strikethrough ? "primary" : "grey-10"')
      q-btn(flat icon='mdi-code-tags' padding='xs' @click='runCommand("toggleInlineCode")' :color='state.marks.inlineCode ? "primary" : "grey-10"')
    q-separator.q-mx-xs(vertical)
    q-btn-group(flat)
      q-btn(flat icon='mdi-format-header-1' padding='xs' @click='setHeading(1)' :color='state.nodes.heading === 1 ? "primary" : "grey-10"')
      q-btn(flat icon='mdi-format-header-2' padding='xs' @click='setHeading(2)' :color='state.nodes.heading === 2 ? "primary" : "grey-10"')
      q-btn(flat icon='mdi-format-header-3' padding='xs' @click='setHeading(3)' :color='state.nodes.heading === 3 ? "primary" : "grey-10"')
    q-separator.q-mx-xs(vertical)
    q-btn-group(flat)
      q-btn(flat icon='mdi-format-list-bulleted' padding='xs' @click='runCommand("wrapInBulletList")')
      q-btn(flat icon='mdi-format-list-numbered' padding='xs' @click='runCommand("wrapInOrderedList")')
      q-btn(flat icon='mdi-checkbox-marked-outline' padding='xs' @click='runCommand("turnIntoTaskList")')
    q-separator.q-mx-xs(vertical)
    q-btn-group(flat)
      q-btn(flat icon='mdi-format-quote-close' padding='xs' @click='runCommand("wrapInBlockquote")')
      q-btn(flat icon='mdi-code-braces' padding='xs' @click='runCommand("createCodeBlock")')
      q-btn(flat icon='mdi-minus' padding='xs' @click='runCommand("insertHr")')
    q-separator.q-mx-xs(vertical)
    q-btn-group(flat)
      q-btn(flat icon='mdi-link-variant' padding='xs' @click='insertLink')
      q-btn(flat icon='mdi-image' padding='xs' @click='insertImage')
      q-btn(flat icon='mdi-table' padding='xs' @click='runCommand("insertTable")')
    q-space
    q-btn(flat :icon='state.sourceMode ? "mdi-eye" : "mdi-code-tags"' padding='xs' @click='toggleSourceMode' :color='state.sourceMode ? "primary" : "grey-10"')

  //- Milkdown WYSIWYG editor
  MilkdownProvider(v-show='!state.sourceMode')
    Milkdown

  //- Source mode (raw markdown)
  q-input.milkdown-source(
    v-if='state.sourceMode'
    v-model='state.markdown'
    type='textarea'
    outlined
    autogrow
    :input-style='{ fontFamily: "monospace", fontSize: "14px", lineHeight: "1.6" }'
    @update:model-value='onSourceUpdate'
  )

  //- Slash menu
  .milkdown-slash-menu(ref='slashMenuRef' v-show='state.slashOpen')
    q-list(dense bordered separator)
      q-item(
        v-for='item in slashItems'
        :key='item.key'
        clickable
        v-ripple
        @click='item.action'
        :active='state.slashSelected === item.key'
        active-class='bg-blue-1'
      )
        q-item-section(avatar)
          q-icon(:name='item.icon' size='20px')
        q-item-section
          q-item-label {{ item.label }}
          q-item-label(caption) {{ item.hint }}

  //- Status bar
  .milkdown-statusbar
    q-badge(outline :color='state.collabEnabled ? "green" : "grey"' :label='state.collabEnabled ? "Collab" : "Local"')
    q-badge.q-ml-sm(outline color='grey' :label='`${state.wordCount} words`')
    q-badge.q-ml-sm(outline color='blue' label='Markdown')
    q-space
    span.text-caption.text-grey-6(v-if='state.lastSaved') Saved {{ state.lastSaved }}
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { DateTime } from 'luxon'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

// Milkdown
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, commandsCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/vue'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInBlockquoteCommand, insertHrCommand, insertImageCommand, turnIntoTextCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { clipboard } from '@milkdown/plugin-clipboard'
import { indent } from '@milkdown/plugin-indent'
import { trailing } from '@milkdown/plugin-trailing'
import { cursor } from '@milkdown/plugin-cursor'
import { upload } from '@milkdown/plugin-upload'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { slash, slashFactory } from '@milkdown/plugin-slash'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

const $q = useQuasar()
const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

let milkdownEditor = null
let ydoc = null
let collabProvider = null

const slashMenuRef = ref(null)

const state = reactive({
  sourceMode: false,
  markdown: '',
  collabEnabled: false,
  wordCount: 0,
  lastSaved: '',
  slashOpen: false,
  slashSelected: '',
  marks: { strong: false, emphasis: false, strikethrough: false, inlineCode: false },
  nodes: { heading: 0 }
})

// Slash menu items
const slashItems = [
  { key: 'h1', icon: 'mdi-format-header-1', label: 'Heading 1', hint: 'Big section heading', action: () => setHeading(1) },
  { key: 'h2', icon: 'mdi-format-header-2', label: 'Heading 2', hint: 'Medium section heading', action: () => setHeading(2) },
  { key: 'h3', icon: 'mdi-format-header-3', label: 'Heading 3', hint: 'Small section heading', action: () => setHeading(3) },
  { key: 'bullet', icon: 'mdi-format-list-bulleted', label: 'Bullet List', hint: 'Unordered list', action: () => runCommand('wrapInBulletList') },
  { key: 'ordered', icon: 'mdi-format-list-numbered', label: 'Numbered List', hint: 'Ordered list', action: () => runCommand('wrapInOrderedList') },
  { key: 'task', icon: 'mdi-checkbox-marked-outline', label: 'Task List', hint: 'Checkboxes', action: () => runCommand('turnIntoTaskList') },
  { key: 'quote', icon: 'mdi-format-quote-close', label: 'Blockquote', hint: 'Quote block', action: () => runCommand('wrapInBlockquote') },
  { key: 'code', icon: 'mdi-code-braces', label: 'Code Block', hint: 'Fenced code block', action: () => runCommand('createCodeBlock') },
  { key: 'table', icon: 'mdi-table', label: 'Table', hint: 'Insert table', action: () => runCommand('insertTable') },
  { key: 'hr', icon: 'mdi-minus', label: 'Divider', hint: 'Horizontal rule', action: () => runCommand('insertHr') },
  { key: 'image', icon: 'mdi-image', label: 'Image', hint: 'Insert image', action: () => insertImage() },
  { key: 'mermaid', icon: 'mdi-graph-outline', label: 'Mermaid Diagram', hint: 'Insert diagram', action: () => insertMermaid() }
]

// Command map for toolbar
const commandMap = {
  toggleStrong: toggleStrongCommand.key,
  toggleEmphasis: toggleEmphasisCommand.key,
  toggleStrikethrough: toggleStrikethroughCommand.key,
  wrapInBlockquote: wrapInBlockquoteCommand.key,
  insertHr: insertHrCommand.key,
  insertTable: insertTableCommand.key
}

function runCommand (name) {
  if (!milkdownEditor) return
  const cmd = commandMap[name]
  if (cmd) {
    milkdownEditor.action((ctx) => {
      const commands = ctx.get(commandsCtx)
      commands.call(cmd)
    })
  }
}

function setHeading (level) {
  if (!milkdownEditor) return
  milkdownEditor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state: edState, dispatch } = view
    const { $from } = edState.selection
    const nodeType = edState.schema.nodes.heading
    if (nodeType) {
      const tr = edState.tr.setBlockType($from.pos, $from.pos, nodeType, { level })
      dispatch(tr)
    }
  })
}

function insertLink () {
  $q.dialog({
    title: 'Insert Link',
    message: 'URL:',
    prompt: { model: '', type: 'url' },
    cancel: true
  }).onOk(url => {
    if (!url || !milkdownEditor) return
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state: edState, dispatch } = view
      const markType = edState.schema.marks.link
      if (markType) {
        const { from, to } = edState.selection
        const tr = edState.tr.addMark(from, to, markType.create({ href: url }))
        dispatch(tr)
      }
    })
  })
}

function insertImage () {
  $q.dialog({
    title: 'Insert Image',
    message: 'Image URL:',
    prompt: { model: '', type: 'url' },
    cancel: true
  }).onOk(url => {
    if (!url || !milkdownEditor) return
    milkdownEditor.action((ctx) => {
      const commands = ctx.get(commandsCtx)
      commands.call(insertImageCommand.key, { src: url })
    })
  })
}

function insertMermaid () {
  if (!milkdownEditor) return
  milkdownEditor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state: edState, dispatch } = view
    const codeBlock = edState.schema.nodes.code_block
    if (codeBlock) {
      const node = codeBlock.create({ language: 'mermaid' }, edState.schema.text('graph TD\n  A --> B'))
      dispatch(edState.tr.replaceSelectionWith(node))
    }
  })
}

function getMarkdown () {
  if (!milkdownEditor) return ''
  let md = ''
  milkdownEditor.action((ctx) => {
    const serializer = ctx.get(serializerCtx)
    const view = ctx.get(editorViewCtx)
    md = serializer(view.state.doc)
  })
  return md
}

function toggleSourceMode () {
  if (!state.sourceMode) {
    state.markdown = getMarkdown()
  }
  state.sourceMode = !state.sourceMode
}

function onSourceUpdate (val) {
  // Will sync back when toggling visual mode
  pageStore.$patch({ content: val })
  editorStore.$patch({ lastChangeTimestamp: DateTime.utc() })
}

// Initialize Milkdown editor
const { loading, get: getEditor } = useEditor((root) => {
  const initialContent = pageStore.content || pageStore.render || ''

  const ed = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, initialContent)
      ctx.set(listenerCtx, {
        markdownUpdated: (ctx, md, prevMd) => {
          if (md === prevMd) return
          state.markdown = md
          state.wordCount = md.split(/\s+/).filter(Boolean).length
          pageStore.$patch({
            content: md,
            render: '' // render will be generated server-side
          })
          editorStore.$patch({
            lastChangeTimestamp: DateTime.utc(),
            hasPendingChanges: true
          })
        }
      })
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(clipboard)
    .use(indent)
    .use(trailing)
    .use(cursor)
    .use(upload)

  milkdownEditor = ed
  return ed
})

// Setup collab after mount
onMounted(async () => {
  editorStore.$patch({ hideSideNav: false })

  // Wait for editor
  await nextTick()
  await nextTick()

  // Init Yjs collab
  try {
    ydoc = new Y.Doc()
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const collabUrl = `${wsProtocol}://${window.location.host}/_collab`

    collabProvider = new HocuspocusProvider({
      url: collabUrl,
      name: pageStore.id || 'default',
      document: ydoc,
      token: document.cookie.match(/jwt=([^;]+)/)?.[1] || 'anonymous',
      onConnect () {
        state.collabEnabled = true
      },
      onDisconnect () {
        state.collabEnabled = false
      }
    })
  } catch (err) {
    console.warn('[Milkdown Collab] Init failed:', err.message)
  }

  // Initial word count
  const md = pageStore.content || ''
  state.wordCount = md.split(/\s+/).filter(Boolean).length
})

onBeforeUnmount(() => {
  if (collabProvider) {
    collabProvider.destroy()
    collabProvider = null
  }
  if (ydoc) {
    ydoc.destroy()
    ydoc = null
  }
})
</script>

<style lang="scss">
.milkdown-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.milkdown-toolbar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid #E2E8F0;
  background: #FAFBFC;
  position: sticky;
  top: 0;
  z-index: 10;

  @at-root .body--dark & {
    background: #1E1E2E;
    border-bottom-color: #374151;
  }

  .q-btn {
    min-width: 32px !important;
  }
}

.milkdown-statusbar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  border-top: 1px solid #E2E8F0;
  background: #FAFBFC;

  @at-root .body--dark & {
    background: #1E1E2E;
    border-top-color: #374151;
  }
}

// Milkdown editor styling
.milkdown {
  flex: 1;
  overflow-y: auto;

  .editor {
    max-width: 860px;
    margin: 0 auto;
    padding: 32px 24px;
    min-height: 500px;
    outline: none;

    &:focus {
      outline: none;
    }
  }

  // Typography
  h1 { font-size: 2rem; font-weight: 700; margin: 1.5em 0 0.5em; }
  h2 { font-size: 1.5rem; font-weight: 600; margin: 1.3em 0 0.4em; }
  h3 { font-size: 1.25rem; font-weight: 600; margin: 1.2em 0 0.3em; }
  h4 { font-size: 1.1rem; font-weight: 600; margin: 1em 0 0.3em; }

  p { margin: 0.5em 0; line-height: 1.7; }

  ul, ol { padding-left: 1.5em; }
  li { margin: 0.2em 0; }

  blockquote {
    border-left: 4px solid #006FEE;
    padding: 8px 16px;
    margin: 1em 0;
    background: rgba(0,111,238,0.05);
    border-radius: 0 8px 8px 0;
  }

  code {
    background: rgba(0,0,0,0.06);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'JetBrains Mono', monospace;
  }

  pre {
    background: #1E1E2E;
    color: #CDD6F4;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;

    code {
      background: none;
      padding: 0;
      color: inherit;
    }
  }

  hr {
    border: none;
    border-top: 2px solid #E2E8F0;
    margin: 2em 0;
  }

  a {
    color: #006FEE;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  img {
    max-width: 100%;
    border-radius: 8px;
    margin: 1em 0;
  }

  // Tables (GFM)
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;

    th, td {
      border: 1px solid #E2E8F0;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: #F4F7FA;
      font-weight: 600;
    }
  }

  // Task list
  .task-list-item {
    display: flex;
    align-items: flex-start;
    list-style: none;

    input[type="checkbox"] {
      margin-right: 8px;
      margin-top: 4px;
    }
  }

  // Dark mode
  @at-root .body--dark & {
    h1, h2, h3, h4 { color: #E2E8F0; }
    code { background: rgba(255,255,255,0.1); }
    blockquote { background: rgba(0,111,238,0.1); }
    hr { border-top-color: #374151; }
    table th { background: #1E1E2E; }
    table th, table td { border-color: #374151; }
  }
}

// Slash menu
.milkdown-slash-menu {
  position: absolute;
  z-index: 100;
  min-width: 240px;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);

  @at-root .body--dark & {
    background: #1E1E2E;
  }
}

// Source mode
.milkdown-source {
  flex: 1;
  .q-field__control {
    height: 100%;
  }
  textarea {
    min-height: 500px;
  }
}
</style>
