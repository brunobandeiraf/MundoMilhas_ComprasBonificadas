export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export function parsePagination(params: PaginationParams): {
  skip: number
  take: number
  page: number
  limit: number
} {
  const page = Math.max(1, Math.floor(params.page ?? DEFAULT_PAGE))
  const rawLimit = Math.max(1, Math.floor(params.limit ?? DEFAULT_LIMIT))
  const limit = Math.min(rawLimit, MAX_LIMIT)

  const skip = (page - 1) * limit
  const take = limit

  return { skip, take, page, limit }
}

export function getPaginationParams(page?: number, limit?: number) {
  const { skip, take } = parsePagination({ page, limit })
  return { skip, take }
}

export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const validPage = Math.max(1, Math.floor(page))
  const rawLimit = Math.max(1, Math.floor(limit))
  const validLimit = Math.min(rawLimit, MAX_LIMIT)
  const totalPages = Math.ceil(total / validLimit)

  return {
    data,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      totalPages,
    },
  }
}
