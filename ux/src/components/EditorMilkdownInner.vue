<template lang="pug">
div
  Milkdown
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, commandsCtx } from '@milkdown/core'
import { Milkdown, useEditor } from '@milkdown/vue'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInOrderedListCommand, insertHrCommand, insertImageCommand, createCodeBlockCommand, wrapInHeadingCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { clipboard } from '@milkdown/plugin-clipboard'
import { indent } from '@milkdown/plugin-indent'
import { trailing } from '@milkdown/plugin-trailing'
import { cursor } from '@milkdown/plugin-cursor'
import { upload } from '@milkdown/plugin-upload'
import { DateTime } from 'luxon'

const props = defineProps({
  initialContent: { type: String, default: '' }
})

const emit = defineEmits(['update', 'editorReady'])

useEditor((root) => {
  const ed = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, props.initialContent)

      const lm = ctx.get(listenerCtx)
      lm.markdownUpdated((ctx, md, prevMd) => {
        if (md === prevMd) return
        emit('update', md)
      })
    })
    .use(commonmark)
    .use(gfm)
    .use(listener)
    .use(history)
    .use(clipboard)
    .use(indent)
    .use(trailing)
    .use(cursor)
    .use(upload)

  emit('editorReady', ed)
  return ed
})
</script>
