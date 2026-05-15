import { useState, useRef, useCallback, useEffect } from 'react'
import type { StoreFilters } from '../services/api'

interface UseFiltersReturn {
  filters: StoreFilters
  setSearch: (value: string) => void
  setMinScore: (value: number | undefined) => void
  setMaxScore: (value: number | undefined) => void
  clearFilters: () => void
}

export function useFilters(): UseFiltersReturn {
  const [search, setSearchState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [minScore, setMinScore] = useState<number | undefined>(undefined)
  const [maxScore, setMaxScore] = useState<number | undefined>(undefined)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSearch = useCallback((value: string) => {
    setSearchState(value)
  }, [])

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [search])

  const clearFilters = useCallback(() => {
    setSearchState('')
    setDebouncedSearch('')
    setMinScore(undefined)
    setMaxScore(undefined)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
  }, [])

  const filters: StoreFilters = {
    search: debouncedSearch || undefined,
    minScore,
    maxScore,
  }

  return { filters, setSearch, setMinScore, setMaxScore, clearFilters }
}
