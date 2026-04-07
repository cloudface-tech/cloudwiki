import { describe, it, expect } from 'vitest'
import { blendScores } from '../../modules/search/hybridSearch.mjs'

describe('blendScores', () => {
  it('should combine keyword and vector scores with given weights', () => {
    const results = [
      { id: 1, ftsScore: 1.0, vectorScore: 0.5 },
      { id: 2, ftsScore: 0.3, vectorScore: 0.9 }
    ]
    const blended = blendScores(results, 0.6, 0.4)
    expect(blended[0].score).toBeCloseTo(0.8, 2)
    expect(blended[1].score).toBeCloseTo(0.54, 2)
  })

  it('should sort by blended score descending', () => {
    const results = [
      { id: 1, ftsScore: 0.1, vectorScore: 0.1 },
      { id: 2, ftsScore: 0.9, vectorScore: 0.9 }
    ]
    const blended = blendScores(results, 0.6, 0.4)
    expect(blended[0].id).toBe(2)
    expect(blended[1].id).toBe(1)
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

  it('should handle empty results', () => {
    expect(blendScores([], 0.6, 0.4)).toEqual([])
  })

  it('should preserve original result properties', () => {
    const results = [{ id: 1, title: 'Test', ftsScore: 1.0, vectorScore: 0.5 }]
    const blended = blendScores(results, 0.6, 0.4)
    expect(blended[0].title).toBe('Test')
    expect(blended[0].id).toBe(1)
  })
})
