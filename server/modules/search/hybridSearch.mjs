export function blendScores (results, keywordWeight, vectorWeight) {
  return results
    .map(r => ({
      ...r,
      score: (keywordWeight * (r.ftsScore || 0)) + (vectorWeight * (r.vectorScore || 0))
    }))
    .sort((a, b) => b.score - a.score)
}

export function buildVectorSearchClause (knex, queryEmbedding) {
  const embeddingStr = `[${queryEmbedding.join(',')}]`
  return knex.raw(
    '1 - (embedding <=> ?::vector) AS "vectorScore"',
    [embeddingStr]
  )
}
