<template lang="pug">
Milkdown
</template>

<script setup>
import { watch } from 'vue'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { Milkdown, useEditor, useInstance } from '@milkdown/vue'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { clipboard } from '@milkdown/plugin-clipboard'
import { indent } from '@milkdown/plugin-indent'
import { trailing } from '@milkdown/plugin-trailing'
import { cursor } from '@milkdown/plugin-cursor'

const props = defineProps({
  initialContent: { type: String, default: '' }
})

const emit = defineEmits(['update', 'ready'])

useEditor((root) => {
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, props.initialContent)

      const lm = ctx.get(listenerCtx)
      lm.markdownUpdated((_ctx, md, prevMd) => {
        if (md !== prevMd) emit('update', md)
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
})

// Expose editor instance to parent when ready
const [loading, getInstance] = useInstance()

watch(loading, (isLoading) => {
  if (!isLoading) {
    emit('ready', getInstance())
  }
})
</script>
