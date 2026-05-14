import { describe, it, expect } from 'vitest'
import { getPaginationParams, parsePagination, formatPaginatedResponse } from '../../../src/utils/pagination.js'

describe('getPaginationParams', () => {
  it('returns defaults when no arguments provided', () => {
    const result = getPaginationParams()
    expect(result).toEqual({ skip: 0, take: 50 })
  })

  it('returns defaults when undefined is passed', () => {
    const result = getPaginationParams(undefined, undefined)
    expect(result).toEqual({ skip: 0, take: 50 })
  })

  it('calculates correct skip for page 2 with default limit', () => {
    const result = getPaginationParams(2)
    expect(result).toEqual({ skip: 50, take: 50 })
  })

  it('calculates correct skip for page 3 with limit 20', () => {
    const result = getPaginationParams(3, 20)
    expect(result).toEqual({ skip: 40, take: 20 })
  })

  it('clamps limit to max 100', () => {
    const result = getPaginationParams(1, 200)
    expect(result).toEqual({ skip: 0, take: 100 })
  })

  it('clamps page to minimum 1 when 0 is passed', () => {
    const result = getPaginationParams(0, 10)
    expect(result).toEqual({ skip: 0, take: 10 })
  })

  it('clamps page to minimum 1 when negative is passed', () => {
    const result = getPaginationParams(-5, 10)
    expect(result).toEqual({ skip: 0, take: 10 })
  })

  it('clamps limit to minimum 1 when 0 is passed', () => {
    const result = getPaginationParams(1, 0)
    expect(result).toEqual({ skip: 0, take: 1 })
  })

  it('clamps limit to minimum 1 when negative is passed', () => {
    const result = getPaginationParams(1, -10)
    expect(result).toEqual({ skip: 0, take: 1 })
  })

  it('floors fractional page values', () => {
    const result = getPaginationParams(2.7, 10)
    expect(result).toEqual({ skip: 10, take: 10 })
  })

  it('floors fractional limit values', () => {
    const result = getPaginationParams(1, 25.9)
    expect(result).toEqual({ skip: 0, take: 25 })
  })
})

describe('parsePagination', () => {
  it('returns defaults when empty params provided', () => {
    const result = parsePagination({})
    expect(result).toEqual({ skip: 0, take: 50, page: 1, limit: 50 })
  })

  it('calculates correct skip and returns page/limit for page 2', () => {
    const result = parsePagination({ page: 2 })
    expect(result).toEqual({ skip: 50, take: 50, page: 2, limit: 50 })
  })

  it('calculates correct values for page 3 with limit 20', () => {
    const result = parsePagination({ page: 3, limit: 20 })
    expect(result).toEqual({ skip: 40, take: 20, page: 3, limit: 20 })
  })

  it('clamps limit to max 100', () => {
    const result = parsePagination({ page: 1, limit: 200 })
    expect(result).toEqual({ skip: 0, take: 100, page: 1, limit: 100 })
  })

  it('clamps page to minimum 1 when 0 is passed', () => {
    const result = parsePagination({ page: 0, limit: 10 })
    expect(result).toEqual({ skip: 0, take: 10, page: 1, limit: 10 })
  })

  it('clamps negative page to 1', () => {
    const result = parsePagination({ page: -3, limit: 10 })
    expect(result).toEqual({ skip: 0, take: 10, page: 1, limit: 10 })
  })

  it('clamps limit to minimum 1 when 0 is passed', () => {
    const result = parsePagination({ page: 1, limit: 0 })
    expect(result).toEqual({ skip: 0, take: 1, page: 1, limit: 1 })
  })

  it('floors fractional page and limit values', () => {
    const result = parsePagination({ page: 2.7, limit: 25.9 })
    expect(result).toEqual({ skip: 25, take: 25, page: 2, limit: 25 })
  })
})

describe('formatPaginatedResponse', () => {
  it('formats response with correct pagination metadata', () => {
    const data = [{ id: 1 }, { id: 2 }]
    const result = formatPaginatedResponse(data, 100, 1, 50)

    expect(result).toEqual({
      data,
      pagination: {
        page: 1,
        limit: 50,
        total: 100,
        totalPages: 2,
      },
    })
  })

  it('calculates totalPages correctly with remainder', () => {
    const data = [{ id: 1 }]
    const result = formatPaginatedResponse(data, 51, 2, 50)

    expect(result.pagination.totalPages).toBe(2)
  })

  it('returns totalPages 0 when total is 0', () => {
    const result = formatPaginatedResponse([], 0, 1, 50)

    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
    })
  })

  it('clamps limit to max 100 in response', () => {
    const data = [{ id: 1 }]
    const result = formatPaginatedResponse(data, 500, 1, 200)

    expect(result.pagination.limit).toBe(100)
    expect(result.pagination.totalPages).toBe(5)
  })

  it('handles single page of results', () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = formatPaginatedResponse(data, 3, 1, 50)

    expect(result.pagination.totalPages).toBe(1)
  })

  it('preserves generic type in data array', () => {
    interface Store {
      name: string
      score: number
    }
    const data: Store[] = [
      { name: 'Store A', score: 10 },
      { name: 'Store B', score: 5 },
    ]
    const result = formatPaginatedResponse(data, 2, 1, 50)

    expect(result.data).toEqual(data)
    expect(result.data[0]?.name).toBe('Store A')
  })
})
