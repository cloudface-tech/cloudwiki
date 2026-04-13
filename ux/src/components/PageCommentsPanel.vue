<template lang="pug">
.page-comments-panel
  .page-comments-header
    q-icon(name='las la-comments' size='24px' color='primary')
    span.text-subtitle1.q-ml-sm Comments ({{ state.total }})
  q-separator.q-my-md

  //- Comment list
  .page-comments-list(v-if='state.comments.length')
    .page-comment(v-for='comment in state.comments' :key='comment.id')
      .page-comment-main
        .page-comment-meta
          q-avatar(size='28px' color='primary' text-color='white')
            | {{ comment.authorName.charAt(0).toUpperCase() }}
          strong.q-ml-sm {{ comment.authorName }}
          span.text-grey-6.q-ml-sm {{ formatDate(comment.createdAt) }}
          q-space
          q-btn(
            flat round dense
            icon='las la-reply'
            size='sm'
            color='grey-6'
            @click='startReply(comment.id)'
          )
          q-btn(
            flat round dense
            icon='las la-trash-alt'
            size='sm'
            color='negative'
            @click='deleteComment(comment.id)'
          )
        .page-comment-content.q-ml-xl(v-html='renderContent(comment.content)')

      //- Replies
      .page-comment-replies(v-if='comment.replies && comment.replies.length')
        .page-comment.page-comment--reply(v-for='reply in comment.replies' :key='reply.id')
          .page-comment-meta
            q-avatar(size='24px' color='grey-5' text-color='white')
              | {{ reply.authorName.charAt(0).toUpperCase() }}
            strong.q-ml-sm.text-body2 {{ reply.authorName }}
            span.text-grey-6.q-ml-sm.text-caption {{ formatDate(reply.createdAt) }}
            q-space
            q-btn(
              flat round dense
              icon='las la-trash-alt'
              size='xs'
              color='negative'
              @click='deleteComment(reply.id)'
            )
          .page-comment-content.q-ml-xl.text-body2(v-html='renderContent(reply.content)')

      //- Reply form
      .page-comment-reply-form.q-ml-xl.q-mt-sm(v-if='state.replyingTo === comment.id')
        q-input(
          v-model='state.replyText'
          outlined dense
          placeholder='Write a reply... Use @name to mention'
          @keyup.enter='submitReply(comment.id)'
        )
          template(v-slot:append)
            q-btn(flat dense icon='las la-paper-plane' color='primary' @click='submitReply(comment.id)')

  .text-grey-6.text-center.q-py-lg(v-else)
    | No comments yet. Be the first to comment.

  q-separator.q-my-md

  //- New comment form
  .page-comments-form
    q-input(
      v-model='state.authorName'
      outlined dense
      label='Your name'
      class='q-mb-sm'
      v-if='!userStore.authenticated'
    )
    q-input(
      v-model='state.newComment'
      outlined
      type='textarea'
      :rows='3'
      placeholder='Write a comment... Use @name to mention someone'
      autogrow
    )
    .row.q-mt-sm.justify-end
      q-btn(
        unelevated
        color='primary'
        label='Comment'
        no-caps
        icon='las la-comment'
        :loading='state.submitting'
        :disable='!state.newComment.trim()'
        @click='submitComment'
      )
</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { usePageStore } from '@/stores/page'
import { useUserStore } from '@/stores/user'
import { DateTime } from 'luxon'

const pageStore = usePageStore()
const userStore = useUserStore()

const state = reactive({
  comments: [],
  total: 0,
  newComment: '',
  authorName: '',
  replyingTo: null,
  replyText: '',
  submitting: false
})

function formatDate (iso) {
  return DateTime.fromISO(iso).toRelative()
}

function renderContent (text) {
  return (text || '').replace(/@(\w+)/g, '<strong class="text-primary">@$1</strong>')
}

function extractMentions (text) {
  const matches = text.match(/@(\w+)/g)
  return matches ? matches.map(m => m.slice(1)) : []
}

async function fetchComments () {
  try {
    const resp = await fetch(`/api/mcp/pages/${pageStore.id}/comments`)
    if (!resp.ok) return
    const data = await resp.json()
    state.comments = data.comments || []
    state.total = data.total || 0
  } catch {}
}

async function submitComment () {
  if (!state.newComment.trim()) return
  state.submitting = true
  try {
    const body = {
      authorName: userStore.authenticated ? userStore.name : (state.authorName || 'Anonymous'),
      content: state.newComment,
      mentions: extractMentions(state.newComment)
    }
    if (userStore.authenticated && userStore.email) {
      body.authorEmail = userStore.email
    }
    const resp = await fetch(`/api/mcp/pages/${pageStore.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (resp.ok) {
      state.newComment = ''
      await fetchComments()
    }
  } finally {
    state.submitting = false
  }
}

function startReply (commentId) {
  state.replyingTo = state.replyingTo === commentId ? null : commentId
  state.replyText = ''
}

async function submitReply (parentId) {
  if (!state.replyText.trim()) return
  try {
    const body = {
      authorName: userStore.authenticated ? userStore.name : (state.authorName || 'Anonymous'),
      content: state.replyText,
      parentId,
      mentions: extractMentions(state.replyText)
    }
    const resp = await fetch(`/api/mcp/pages/${pageStore.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (resp.ok) {
      state.replyingTo = null
      state.replyText = ''
      await fetchComments()
    }
  } catch {}
}

async function deleteComment (id) {
  try {
    const resp = await fetch(`/api/mcp/comments/${id}`, { method: 'DELETE' })
    if (resp.ok) await fetchComments()
  } catch {}
}

onMounted(fetchComments)

watch(() => pageStore.id, fetchComments)
</script>

<style lang="scss">
.page-comments-panel {
  max-width: 860px;
  margin: 32px auto;
  padding: 24px;
}

.page-comments-header {
  display: flex;
  align-items: center;
}

.page-comment {
  margin-bottom: 16px;

  &--reply {
    margin-bottom: 8px;
    padding-left: 16px;
    border-left: 2px solid #E2E8F0;

    @at-root .body--dark & {
      border-left-color: #374151;
    }
  }
}

.page-comment-meta {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.page-comment-content {
  line-height: 1.6;
  word-break: break-word;
}

.page-comment-replies {
  margin-left: 40px;
  margin-top: 8px;
}
</style>
