# CloudWiki — Diagrams Editor + Semantic Search Design Spec

## Overview

Two features for CloudWiki:

1. **Mermaid + Excalidraw diagram blocks** in the TipTap WYSIWYG editor with real-time collaborative editing via Yjs
2. **Hybrid semantic search** combining existing PostgreSQL FTS with pgvector embeddings

## Feature 1: Diagram Blocks in TipTap Editor

### Goal

Users can insert and collaboratively edit diagrams directly in wiki pages — Mermaid for code-based diagrams and Excalidraw for visual/freeform diagrams. All editing happens in the single TipTap WYSIWYG editor with real-time collaboration via Yjs/Hocuspocus.

### Architecture

Two new TipTap Node extensions registered in `EditorWysiwyg.vue`:

#### MermaidBlock Node

- **Storage:** Mermaid source code stored as a text attribute on the ProseMirror node
- **Editor view:** Split pane — compact code editor (left) with live SVG preview (right)
- **Rendering:** Client-side via `mermaid.js` (no Kroki dependency for editing)
- **Collaboration:** Mermaid source text syncs via Yjs as part of the Y.Doc. Each MermaidBlock's text content is a Y.Text fragment within the shared document, giving character-level CRDT sync
- **Read mode:** Renders as SVG only (no code editor visible)
- **Supported diagrams:** flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline, etc. (all Mermaid-supported types)

#### ExcalidrawBlock Node

- **Storage:** Excalidraw scene JSON (elements + appState) stored as a JSON attribute on the ProseMirror node
- **Editor view (inline):** Read-only SVG preview, resizable, shows diagram content
- **Editor view (fullscreen):** Click preview to open fullscreen modal with full Excalidraw editor
- **Collaboration:** Uses `y-excalidraw` binding that syncs Excalidraw elements array through a Y.Map within the shared Y.Doc. Multiple users can edit the same diagram simultaneously in fullscreen mode
- **Read mode:** Static SVG export of the diagram
- **Features:** Shapes, arrows, text, connectors, freehand draw, colors, grouping

#### Toolbar Integration

Single "Diagram" button in the editor toolbar with dropdown submenu:
- **Mermaid** — inserts empty MermaidBlock with template (e.g., `flowchart TD`)
- **Excalidraw** — inserts empty ExcalidrawBlock with blank canvas

#### Data Model

No schema changes. Diagram data lives inside the TipTap document JSON (the `content` column in the `pages` table). Example node structure:

```json
{
  "type": "mermaidBlock",
  "attrs": {
    "code": "flowchart TD\n  A-->B\n  B-->C"
  }
}
```

```json
{
  "type": "excalidrawBlock",
  "attrs": {
    "elements": [...],
    "appState": {...},
    "width": 800,
    "height": 400
  }
}
```

#### Collaboration Details

- Both blocks participate in the existing Yjs collaboration infrastructure (Hocuspocus provider at `/_collab`)
- MermaidBlock: text content mapped to Y.Text via TipTap's built-in Yjs collaboration extension
- ExcalidrawBlock: elements synced via `y-excalidraw` which creates a Y.Map per diagram instance, keyed by a unique block ID
- Cursor awareness: Mermaid shows cursors in code editor; Excalidraw shows cursor positions on canvas
- Conflict resolution: Yjs CRDT handles all merge conflicts automatically

#### Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `mermaid` | Client-side diagram rendering | ~2MB |
| `@excalidraw/excalidraw` | Visual diagram editor | ~5MB |
| `y-excalidraw` | Yjs binding for Excalidraw collab | ~50KB |

Excalidraw is a React component. In the Vue 3 TipTap editor, it will be mounted via a thin wrapper using `createApp()` inside the node view, isolated from the Vue app. This is a proven pattern for embedding React components in ProseMirror/TipTap.

### Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `ux/src/components/editor/MermaidBlock.vue` | TipTap node view for Mermaid |
| Create | `ux/src/components/editor/MermaidExtension.js` | TipTap Node extension definition |
| Create | `ux/src/components/editor/ExcalidrawBlock.vue` | TipTap node view wrapper for Excalidraw |
| Create | `ux/src/components/editor/ExcalidrawExtension.js` | TipTap Node extension definition |
| Create | `ux/src/components/editor/ExcalidrawModal.vue` | Fullscreen Excalidraw editor modal |
| Create | `ux/src/components/editor/ExcalidrawReactWrapper.jsx` | React mount wrapper for Excalidraw |
| Modify | `ux/src/components/EditorWysiwyg.vue` | Register new extensions, add toolbar button |
| Modify | `ux/package.json` | Add mermaid, @excalidraw/excalidraw, y-excalidraw |

### Testing

- Unit tests: MermaidExtension and ExcalidrawExtension node serialization/deserialization
- Unit tests: Mermaid rendering with valid/invalid syntax
- Integration tests: Insert block, edit content, verify Y.Doc sync
- E2E tests (Playwright): Insert Mermaid block, type diagram code, verify SVG renders
- E2E tests (Playwright): Insert Excalidraw block, open fullscreen, draw shape, close, verify preview

---

## Feature 2: Hybrid Semantic Search

### Goal

Augment existing PostgreSQL full-text search with vector similarity search using pgvector. Users get better results for natural language queries and conceptual searches, especially in pt-BR content.

### Architecture

#### Embedding Pipeline

```
Page saved/updated
  → Async task: generatePageEmbedding(pageId)
    → Load page content (strip HTML tags)
    → Chunk if > 8192 tokens (overlap 200 tokens)
    → Generate embedding via configured model
    → Normalize vector (L2 norm = 1)
    → Upsert into pages.embedding column
```

#### Search Pipeline (Hybrid Blend)

```
User query
  → Generate query embedding (same model)
  → Execute in parallel:
    ├── PostgreSQL FTS: ts_rank_cd(tsvector, tsquery)
    └── pgvector: 1 - (embedding <=> query_embedding)
  → Combine: score = (weight_keyword * fts_score) + (weight_vector * vector_score)
  → Sort by combined score
  → Return results with highlights
```

#### Embedding Models

| Model | Dimensions | Size | Best for |
|-------|-----------|------|----------|
| multilingual-e5-small (default) | 384 | ~130MB | pt-BR + multilingual content |
| all-MiniLM-L6-v2 | 384 | ~80MB | English-heavy content |
| OpenAI text-embedding-3-small | 1536 | API | Users preferring managed service |

Configurable via Admin > Search settings. Model selection determines vector dimensions.

#### Database Schema

```sql
-- Migration: add pgvector support
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (384 dims for local models, 1536 for OpenAI)
ALTER TABLE pages ADD COLUMN embedding vector(384);
ALTER TABLE pages ADD COLUMN "embeddingModel" varchar(100);

-- IVFFlat index for fast approximate nearest neighbor search
-- Created after initial bulk indexing (needs rows to build)
CREATE INDEX idx_pages_embedding ON pages
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

#### Normalization

All vectors are L2-normalized before storage (cosine similarity = dot product on normalized vectors). This prevents silent failures from models returning unnormalized vectors, as flagged by @m13v on issue #102.

```javascript
function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vector.map(v => v / norm) : vector
}
```

#### Search Weights

Default blend: `0.6 * keyword_score + 0.4 * vector_score`

Configurable via admin. Keyword search still outperforms for exact names and identifiers (per @m13v feedback). Vector search excels at conceptual/natural language queries.

#### Local Model Execution

Local models run via `@xenova/transformers` (ONNX runtime in Node.js). No Python dependency needed. Model files downloaded on first use and cached in `/wiki/data/cache/models/`.

#### Admin Settings

New section in Admin > Search:
- **Embedding model:** dropdown (multilingual-e5-small / all-MiniLM-L6-v2 / OpenAI)
- **OpenAI API key:** text field (shown only when OpenAI selected)
- **Search blend weight:** slider (0.0 = keyword only, 1.0 = vector only, default 0.6/0.4)
- **Re-index button:** trigger bulk re-embedding of all pages

### Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `server/modules/search/embeddings.mjs` | Embedding generation (local + API) |
| Create | `server/modules/search/vectorSearch.mjs` | pgvector query logic |
| Create | `server/modules/search/hybridSearch.mjs` | Blend scoring logic |
| Create | `server/db/migrations/3.0.2.mjs` | Add pgvector extension + embedding column |
| Create | `server/tasks/workers/generate-embeddings.mjs` | Async worker for embedding generation |
| Modify | `server/graph/resolvers/page.mjs` | Integrate hybrid search in searchPages resolver |
| Modify | `server/graph/schemas/page.graphql` | Add embeddingModel and searchMode fields |
| Modify | `server/models/pages.mjs` | Add embedding-related methods |
| Modify | `server/app/data.yml` | Add default search config (model, weights) |
| Modify | `ux/src/components/AdminSearch.vue` (or equivalent) | Admin UI for search settings |
| Modify | `server/package.json` | Add @xenova/transformers, pgvector |

### Testing

- Unit tests: normalize(), blend scoring, embedding generation mock
- Unit tests: Migration 3.0.2 (same pattern as 3.0.1 tests)
- Integration tests: Search with/without embeddings, verify blend scoring
- E2E tests: Search for conceptual query, verify relevant results appear

---

## Scope Boundaries

### In scope
- Mermaid code blocks with live preview and Yjs collab
- Excalidraw visual blocks with inline preview + fullscreen editor + Yjs collab
- Toolbar integration for inserting diagram blocks
- pgvector hybrid search with configurable local/API embeddings
- Admin settings for search model and blend weights
- Async embedding generation on page save
- Vector normalization

### Out of scope
- Mermaid-to-Excalidraw conversion (or vice versa)
- AI-assisted diagram generation
- Image/PDF export of diagrams (beyond browser print)
- Real-time search-as-you-type with embeddings (too slow, keep for FTS only)
- Embedding of non-page content (assets, comments)
- RAG/LLM integration (future, builds on embeddings infrastructure)
