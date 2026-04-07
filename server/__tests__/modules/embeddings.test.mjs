import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalize, stripHtml, getEmbeddingDimensions } from '../../modules/search/embeddings.mjs'

describe('embeddings module', () => {
  describe('normalize', () => {
    it('should normalize a vector to unit length', () => {
      const result = normalize([3, 4])
      const magnitude = Math.sqrt(result.reduce((s, x) => s + x * x, 0))
      expect(magnitude).toBeCloseTo(1.0, 5)
      expect(result[0]).toBeCloseTo(0.6, 5)
      expect(result[1]).toBeCloseTo(0.8, 5)
    })

    it('should return zero vector for zero input', () => {
      expect(normalize([0, 0, 0])).toEqual([0, 0, 0])
    })

    it('should handle single-element vector', () => {
      expect(normalize([5])).toEqual([1])
    })
  })

  describe('stripHtml', () => {
    it('should remove HTML tags and return plain text', () => {
      expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
    })

    it('should handle empty input', () => {
      expect(stripHtml('')).toBe('')
    })

    it('should collapse whitespace', () => {
      expect(stripHtml('<p>Hello</p>  <p>World</p>')).toBe('Hello World')
    })
  })

  describe('getEmbeddingDimensions', () => {
    it('should return 384 for multilingual-e5-small', () => {
      expect(getEmbeddingDimensions('multilingual-e5-small')).toBe(384)
    })

    it('should return 384 for all-MiniLM-L6-v2', () => {
      expect(getEmbeddingDimensions('all-MiniLM-L6-v2')).toBe(384)
    })

    it('should return 1536 for OpenAI model', () => {
      expect(getEmbeddingDimensions('text-embedding-3-small')).toBe(1536)
    })

    it('should return 384 for unknown model', () => {
      expect(getEmbeddingDimensions('unknown-model')).toBe(384)
    })
  })
})
