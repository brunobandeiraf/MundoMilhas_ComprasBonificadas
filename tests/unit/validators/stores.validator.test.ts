import { describe, it, expect } from 'vitest'
import { storeFiltersSchema } from '../../../src/validators/stores.validator.js'

describe('storeFiltersSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = storeFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid filters with all fields', () => {
    const result = storeFiltersSchema.safeParse({
      search: 'Amazon',
      minScore: 5,
      maxScore: 20,
      page: 1,
      limit: 50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects search exceeding 100 characters', () => {
    const result = storeFiltersSchema.safeParse({
      search: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects minScore below 1', () => {
    const result = storeFiltersSchema.safeParse({
      minScore: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects minScore above 99', () => {
    const result = storeFiltersSchema.safeParse({
      minScore: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects maxScore below 1', () => {
    const result = storeFiltersSchema.safeParse({
      maxScore: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects maxScore above 99', () => {
    const result = storeFiltersSchema.safeParse({
      maxScore: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when minScore > maxScore', () => {
    const result = storeFiltersSchema.safeParse({
      minScore: 50,
      maxScore: 30,
    })
    expect(result.success).toBe(false)
  })

  it('accepts when minScore equals maxScore', () => {
    const result = storeFiltersSchema.safeParse({
      minScore: 50,
      maxScore: 50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects page below 1', () => {
    const result = storeFiltersSchema.safeParse({
      page: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit below 1', () => {
    const result = storeFiltersSchema.safeParse({
      limit: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit above 100', () => {
    const result = storeFiltersSchema.safeParse({
      limit: 101,
    })
    expect(result.success).toBe(false)
  })

  it('coerces string numbers to numbers', () => {
    const result = storeFiltersSchema.safeParse({
      minScore: '5',
      maxScore: '20',
      page: '2',
      limit: '25',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minScore).toBe(5)
      expect(result.data.maxScore).toBe(20)
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(25)
    }
  })
})
