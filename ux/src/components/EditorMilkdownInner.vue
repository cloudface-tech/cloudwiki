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
import { upload, uploadConfig } from '@milkdown/plugin-upload'

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

      // Configure image upload handler
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        uploader: async (files, schema) => {
          const images = []
          for (const file of files) {
            if (!file.type.startsWith('image/')) continue
            try {
              const formData = new FormData()
              formData.append('mediaUpload', file)
              const resp = await fetch('/u', { method: 'POST', body: formData })
              if (resp.ok) {
                const data = await resp.json()
                const src = data.url || data.link || `/u/${file.name}`
                const node = schema.nodes.image.createAndFill({ src, alt: file.name })
                if (node) images.push(node)
              }
            } catch (err) {
              console.warn('[Upload] Failed:', err.message)
            }
          }
          return images
        }
      }))
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
})

// Expose editor instance to parent when ready
const [loading, getInstance] = useInstance()

watch(loading, (isLoading) => {
  if (!isLoading) {
    emit('ready', getInstance())
  }
})
</script>
