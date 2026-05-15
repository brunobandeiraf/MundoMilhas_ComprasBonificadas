import { useState, useEffect, useCallback } from 'react'
import {
  getStores,
  type StoreItem,
  type PaginationInfo,
  type StoreFilters,
} from '../services/api'

interface UseStoresReturn {
  stores: StoreItem[]
  pagination: PaginationInfo | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useStores(filters: StoreFilters = {}): UseStoresReturn {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchCount, setRefetchCount] = useState(0)

  const refetch = useCallback(() => {
    setRefetchCount((c) => c + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchStores() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await getStores(filters)
        if (!cancelled) {
          setStores(response.data)
          setPagination(response.pagination)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao buscar lojas')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchStores()

    return () => {
      cancelled = true
    }
  }, [filters.page, filters.limit, filters.search, filters.category, filters.program, filters.sortBy, filters.minScore, filters.maxScore, refetchCount])

  return { stores, pagination, isLoading, error, refetch }
}
