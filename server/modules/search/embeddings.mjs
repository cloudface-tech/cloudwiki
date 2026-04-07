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
