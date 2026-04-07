# Semantic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hybrid semantic search to CloudWiki combining PostgreSQL full-text search with pgvector embeddings for natural language queries.

**Architecture:** Extend existing search resolver with pgvector similarity scoring. Embeddings generated async on page save via configurable model (local multilingual-e5-small default or OpenAI API). Blend scoring: keyword FTS + vector similarity with configurable weights.

**Tech Stack:** PostgreSQL + pgvector, @xenova/transformers (ONNX local inference), Knex.js, Vitest

**Repo:** /tmp/cloudwiki-fix

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/modules/search/embeddings.mjs` | Generate embeddings (local + API) |
| Create | `server/modules/search/hybridSearch.mjs` | Blend scoring logic |
| Create | `server/db/migrations/3.0.2.mjs` | pgvector extension + embedding column |
| Create | `server/tasks/workers/generate-embeddings.mjs` | Async embedding worker |
| Modify | `server/graph/resolvers/page.mjs` | Integrate hybrid search |
| Modify | `server/graph/schemas/page.graphql` | Add searchMode param |
| Modify | `server/app/data.yml` | Default search config |
| Modify | `server/package.json` | Add pgvector, @xenova/transformers |
| Create | `server/__tests__/modules/embeddings.test.mjs` | Tests for embedding module |
| Create | `server/__tests__/modules/hybridSearch.test.mjs` | Tests for blend scoring |
| Create | `server/__tests__/core/migration-3.0.2.test.mjs` | Migration test |

---

### Task 1: Add dependencies

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install pgvector and transformers**

```bash
cd /tmp/cloudwiki-fix/server
pnpm add pgvector @xenova/transformers
```

- [ ] **Step 2: Verify install**

Run: `cd /tmp/cloudwiki-fix/server && pnpm ls pgvector @xenova/transformers`
Expected: Both listed

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml
git commit -m "feat: add pgvector and transformers dependencies for semantic search"
```

---

### Task 2: Create embedding module

**Files:**
- Create: `server/modules/search/embeddings.mjs`
- Test: `server/__tests__/modules/embeddings.test.mjs`

- [ ] **Step 1: Write tests**

```javascript
// server/__tests__/modules/embeddings.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('embeddings module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    WIKI.config.search = {
      embeddingModel: 'multilingual-e5-small',
      openaiApiKey: ''
    }
  })

  describe('normalize', () => {
    it('should normalize a vector to unit length', async () => {
      const { normalize } = await import('../../modules/search/embeddings.mjs')
      const v = [3, 4]
      const result = normalize(v)
      const magnitude = Math.sqrt(result.reduce((s, x) => s + x * x, 0))
      expect(magnitude).toBeCloseTo(1.0, 5)
    })

    it('should return zero vector for zero input', async () => {
      const { normalize } = await import('../../modules/search/embeddings.mjs')
      const result = normalize([0, 0, 0])
      expect(result).toEqual([0, 0, 0])
    })
  })

  describe('stripHtml', () => {
    it('should remove HTML tags and return plain text', async () => {
      const { stripHtml } = await import('../../modules/search/embeddings.mjs')
      expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
    })

    it('should handle empty input', async () => {
      const { stripHtml } = await import('../../modules/search/embeddings.mjs')
      expect(stripHtml('')).toBe('')
    })
  })

  describe('getEmbeddingDimensions', () => {
    it('should return 384 for local models', async () => {
      const { getEmbeddingDimensions } = await import('../../modules/search/embeddings.mjs')
      expect(getEmbeddingDimensions('multilingual-e5-small')).toBe(384)
      expect(getEmbeddingDimensions('all-MiniLM-L6-v2')).toBe(384)
    })

    it('should return 1536 for OpenAI models', async () => {
      const { getEmbeddingDimensions } = await import('../../modules/search/embeddings.mjs')
      expect(getEmbeddingDimensions('text-embedding-3-small')).toBe(1536)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run __tests__/modules/embeddings.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement embeddings module**

```javascript
// server/modules/search/embeddings.mjs

const MODEL_DIMENSIONS = {
  'multilingual-e5-small': 384,
  'all-MiniLM-L6-v2': 384,
  'text-embedding-3-small': 1536
}

const MODEL_HF_IDS = {
  'multilingual-e5-small': 'intfloat/multilingual-e5-small',
  'all-MiniLM-L6-v2': 'Xenova/all-MiniLM-L6-v2'
}

let pipeline = null
let currentModelId = null

export function normalize (vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vector.map(v => v / norm) : vector
}

export function stripHtml (html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export function getEmbeddingDimensions (model) {
  return MODEL_DIMENSIONS[model] || 384
}

async function getLocalPipeline (model) {
  const hfId = MODEL_HF_IDS[model]
  if (!hfId) throw new Error(`Unknown local model: ${model}`)
  if (pipeline && currentModelId === hfId) return pipeline

  const { pipeline: createPipeline } = await import('@xenova/transformers')
  pipeline = await createPipeline('feature-extraction', hfId, {
    cache_dir: WIKI.ROOTPATH + '/data/cache/models'
  })
  currentModelId = hfId
  return pipeline
}

async function generateLocalEmbedding (text, model) {
  const pipe = await getLocalPipeline(model)
  const output = await pipe(text, { pooling: 'mean', normalize: true })
  return normalize(Array.from(output.data))
}

async function generateOpenAIEmbedding (text, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  })
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status}`)
  const data = await resp.json()
  return normalize(data.data[0].embedding)
}

export async function generateEmbedding (text, model, apiKey) {
  if (model === 'text-embedding-3-small') {
    if (!apiKey) throw new Error('OpenAI API key required')
    return generateOpenAIEmbedding(text, apiKey)
  }
  return generateLocalEmbedding(text, model)
}
```

- [ ] **Step 4: Run tests**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run __tests__/modules/embeddings.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/modules/search/embeddings.mjs server/__tests__/modules/embeddings.test.mjs
git commit -m "feat: add embedding generation module with local and OpenAI support"
```

---

### Task 3: Create hybrid search blend scoring

**Files:**
- Create: `server/modules/search/hybridSearch.mjs`
- Test: `server/__tests__/modules/hybridSearch.test.mjs`

- [ ] **Step 1: Write tests**

```javascript
// server/__tests__/modules/hybridSearch.test.mjs
import { describe, it, expect } from 'vitest'
import { blendScores, buildHybridQuery } from '../../modules/search/hybridSearch.mjs'

describe('blendScores', () => {
  it('should combine keyword and vector scores with default weights', () => {
    const results = [
      { id: 1, ftsScore: 1.0, vectorScore: 0.5 },
      { id: 2, ftsScore: 0.3, vectorScore: 0.9 }
    ]
    const blended = blendScores(results, 0.6, 0.4)
    expect(blended[0].score).toBeCloseTo(0.8, 2) // 0.6*1.0 + 0.4*0.5
    expect(blended[1].score).toBeCloseTo(0.54, 2) // 0.6*0.3 + 0.4*0.9
  })

  it('should sort by blended score descending', () => {
    const results = [
      { id: 1, ftsScore: 0.1, vectorScore: 0.1 },
      { id: 2, ftsScore: 0.9, vectorScore: 0.9 }
    ]
    const blended = blendScores(results, 0.6, 0.4)
    expect(blended[0].id).toBe(2)
  })

  it('should handle zero keyword weight (vector only)', () => {
    const results = [{ id: 1, ftsScore: 1.0, vectorScore: 0.5 }]
    const blended = blendScores(results, 0.0, 1.0)
    expect(blended[0].score).toBeCloseTo(0.5, 2)
  })

  it('should handle missing vectorScore gracefully', () => {
    const results = [{ id: 1, ftsScore: 0.8, vectorScore: null }]
    const blended = blendScores(results, 0.6, 0.4)
    expect(blended[0].score).toBeCloseTo(0.48, 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run __tests__/modules/hybridSearch.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement hybrid search module**

```javascript
// server/modules/search/hybridSearch.mjs

export function blendScores (results, keywordWeight, vectorWeight) {
  return results
    .map(r => ({
      ...r,
      score: (keywordWeight * (r.ftsScore || 0)) + (vectorWeight * (r.vectorScore || 0))
    }))
    .sort((a, b) => b.score - a.score)
}

export function buildVectorSearchClause (knex, queryEmbedding, limit) {
  const embeddingStr = `[${queryEmbedding.join(',')}]`
  return knex.raw(
    `1 - (embedding <=> ?::vector) AS "vectorScore"`,
    [embeddingStr]
  )
}
```

- [ ] **Step 4: Run tests**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run __tests__/modules/hybridSearch.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/modules/search/hybridSearch.mjs server/__tests__/modules/hybridSearch.test.mjs
git commit -m "feat: add hybrid search blend scoring module"
```

---

### Task 4: Create database migration 3.0.2

**Files:**
- Create: `server/db/migrations/3.0.2.mjs`
- Test: `server/__tests__/core/migration-3.0.2.test.mjs`

- [ ] **Step 1: Write migration test**

```javascript
// server/__tests__/core/migration-3.0.2.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { up } from '../../db/migrations/3.0.2.mjs'

describe('Migration 3.0.2 — pgvector semantic search', () => {
  let knex

  beforeEach(() => {
    knex = {
      raw: vi.fn().mockResolvedValue(undefined),
      schema: {
        hasColumn: vi.fn().mockResolvedValue(false),
        alterTable: vi.fn().mockResolvedValue(undefined)
      }
    }
  })

  it('should create vector extension', async () => {
    await up(knex)
    expect(knex.raw).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector')
  })

  it('should add embedding column if not exists', async () => {
    knex.schema.hasColumn.mockResolvedValue(false)
    await up(knex)
    expect(knex.schema.alterTable).toHaveBeenCalled()
  })

  it('should skip embedding column if already exists', async () => {
    knex.schema.hasColumn.mockResolvedValue(true)
    await up(knex)
    expect(knex.schema.alterTable).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run __tests__/core/migration-3.0.2.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement migration**

```javascript
// server/db/migrations/3.0.2.mjs
/**
 * CloudWiki 3.0.2 Migration
 * Add pgvector support for semantic search
 */

export async function up (knex) {
  // Enable pgvector extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector')
  console.info('[3.0.2] pgvector extension enabled')

  // Add embedding column to pages table
  const hasEmbedding = await knex.schema.hasColumn('pages', 'embedding')
  if (!hasEmbedding) {
    await knex.schema.alterTable('pages', table => {
      table.specificType('embedding', 'vector(384)')
      table.string('embeddingModel', 100)
    })
    console.info('[3.0.2] Added embedding column to pages table')
  }
}

export function down (knex) {}
```

- [ ] **Step 4: Run tests**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run __tests__/core/migration-3.0.2.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/db/migrations/3.0.2.mjs server/__tests__/core/migration-3.0.2.test.mjs
git commit -m "feat: add migration 3.0.2 for pgvector embedding column"
```

---

### Task 5: Create async embedding worker

**Files:**
- Create: `server/tasks/workers/generate-embeddings.mjs`

- [ ] **Step 1: Implement worker**

```javascript
// server/tasks/workers/generate-embeddings.mjs
import { generateEmbedding, stripHtml, getEmbeddingDimensions } from '../../modules/search/embeddings.mjs'

export async function generatePageEmbedding (pageId) {
  const model = WIKI.config.search?.embeddingModel || 'multilingual-e5-small'
  const apiKey = WIKI.config.search?.openaiApiKey || ''

  const page = await WIKI.db.knex('pages')
    .where('id', pageId)
    .select('id', 'title', 'description', 'searchContent')
    .first()

  if (!page) {
    WIKI.logger.warn(`[Embeddings] Page ${pageId} not found`)
    return
  }

  const text = [page.title, page.description, stripHtml(page.searchContent || '')]
    .filter(Boolean)
    .join(' ')
    .slice(0, 8192)

  if (text.length < 10) {
    WIKI.logger.debug(`[Embeddings] Skipping page ${pageId} — too short`)
    return
  }

  try {
    const embedding = await generateEmbedding(text, model, apiKey)
    const embeddingStr = `[${embedding.join(',')}]`

    await WIKI.db.knex('pages')
      .where('id', pageId)
      .update({
        embedding: WIKI.db.knex.raw('?::vector', [embeddingStr]),
        embeddingModel: model
      })

    WIKI.logger.debug(`[Embeddings] Generated embedding for page ${pageId} (${model})`)
  } catch (err) {
    WIKI.logger.warn(`[Embeddings] Failed for page ${pageId}: ${err.message}`)
  }
}

export async function reindexAllPages () {
  const pages = await WIKI.db.knex('pages')
    .select('id')
    .where('publishState', 'published')

  WIKI.logger.info(`[Embeddings] Re-indexing ${pages.length} pages...`)

  for (const page of pages) {
    await generatePageEmbedding(page.id)
  }

  WIKI.logger.info(`[Embeddings] Re-indexing complete`)
}
```

- [ ] **Step 2: Commit**

```bash
git add server/tasks/workers/generate-embeddings.mjs
git commit -m "feat: add async embedding generation worker"
```

---

### Task 6: Integrate hybrid search into page resolver

**Files:**
- Modify: `server/graph/resolvers/page.mjs`
- Modify: `server/graph/schemas/page.graphql`
- Modify: `server/app/data.yml`

- [ ] **Step 1: Add searchMode to GraphQL schema**

In `server/graph/schemas/page.graphql`, add after line 53 (`publishState: PagePublishState`):

```graphql
    """
    Search mode: keyword (FTS only), hybrid (FTS + vector), vector (vector only). Defaults to hybrid when embeddings are available.
    """
    searchMode: PageSearchMode
```

Add the enum at the end of the file:

```graphql
enum PageSearchMode {
  keyword
  hybrid
  vector
}
```

- [ ] **Step 2: Add default search config to data.yml**

In `server/app/data.yml`, in the `defaults.config.search` section, add:

```yaml
    search:
      dictOverrides: {}
      termHighlighting: true
      embeddingModel: multilingual-e5-small
      openaiApiKey: ''
      keywordWeight: 0.6
      vectorWeight: 0.4
```

- [ ] **Step 3: Update search resolver with hybrid support**

In `server/graph/resolvers/page.mjs`, add imports at the top:

```javascript
import { generateEmbedding, getEmbeddingDimensions } from '../../modules/search/embeddings.mjs'
import { blendScores, buildVectorSearchClause } from '../../modules/search/hybridSearch.mjs'
```

In the `searchPages` resolver (line 64-137), after the existing `searchCols` setup, add vector search column when hybrid/vector mode:

```javascript
        // -> Determine search mode
        const searchMode = args.searchMode || (WIKI.config.search?.embeddingModel ? 'hybrid' : 'keyword')
        let queryEmbedding = null

        if (searchMode !== 'keyword' && hasQuery) {
          try {
            queryEmbedding = await generateEmbedding(
              q,
              WIKI.config.search.embeddingModel,
              WIKI.config.search.openaiApiKey
            )
            const embeddingStr = `[${queryEmbedding.join(',')}]`
            searchCols.push(WIKI.db.knex.raw(
              '1 - (embedding <=> ?::vector) AS "vectorScore"',
              [embeddingStr]
            ))
          } catch (err) {
            WIKI.logger.warn(`[Search] Embedding generation failed, falling back to keyword: ${err.message}`)
          }
        }
```

After the results query (line 119), add blend scoring:

```javascript
        // -> Apply hybrid blend scoring
        if (queryEmbedding && results.length > 0) {
          const kw = WIKI.config.search?.keywordWeight ?? 0.6
          const vw = WIKI.config.search?.vectorWeight ?? 0.4
          const blended = blendScores(
            results.map(r => ({
              ...r,
              ftsScore: r.relevancy || 0,
              vectorScore: r.vectorScore || 0
            })),
            kw,
            vw
          )
          results.length = 0
          results.push(...blended)
        }
```

- [ ] **Step 4: Hook embedding generation into page save**

In the page resolver's update/create mutation, add after successful save:

```javascript
        // -> Generate embedding async (fire and forget)
        import('../../tasks/workers/generate-embeddings.mjs')
          .then(({ generatePageEmbedding }) => generatePageEmbedding(page.id))
          .catch(err => WIKI.logger.warn(`[Embeddings] Async generation failed: ${err.message}`))
```

- [ ] **Step 5: Run full server test suite**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/graph/resolvers/page.mjs server/graph/schemas/page.graphql server/app/data.yml
git commit -m "feat: integrate hybrid semantic search into page resolver"
```

---

### Task 7: Run full test suite and push

- [ ] **Step 1: Run server tests**

Run: `cd /tmp/cloudwiki-fix/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run UX tests**

Run: `cd /tmp/cloudwiki-fix/ux && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Push**

```bash
git push origin main
```
