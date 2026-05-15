import { useState, useEffect } from 'react'
import { useStores } from '../hooks/useStores'
import { useFilters } from '../hooks/useFilters'
import StoreList from '../components/StoreList'
import Pagination from '../components/Pagination'
import { SearchFilter } from '../components/SearchFilter'
import { ScoreRangeFilter } from '../components/ScoreRangeFilter'
import { getCategories } from '../services/api'

export default function StoresPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const { filters, setSearch, setMinScore, setMaxScore, clearFilters } = useFilters()
  const [searchValue, setSearchValue] = useState('')

  const { stores, pagination, isLoading, error } = useStores({
    ...filters,
    category: category || undefined,
    page,
    limit,
  })

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  function handleSearchChange(value: string) {
    setSearchValue(value)
    setPage(1)
    setSearch(value)
  }

  function handleCategoryChange(value: string) {
    setCategory(value)
    setPage(1)
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit)
    setPage(1)
  }

  function handleClearFilters() {
    setSearchValue('')
    setCategory('')
    setPage(1)
    clearFilters()
  }

  const hasFilters = !!filters.search || !!category || filters.minScore !== undefined || filters.maxScore !== undefined

  return (
    <main className="stores-page">
      <div className="stores-container">
        <div className="stores-header">
          <h1>Promoções</h1>
          {pagination && !isLoading && (
            <p className="stores-showing">
              Mostrando <strong>{stores.length}</strong> de <strong>{pagination.total}</strong> lojas
            </p>
          )}
        </div>

        <div className="stores-filters-bar">
          <SearchFilter value={searchValue} onChange={handleSearchChange} />

          {categories.length > 0 && (
            <div className="filter-category">
              <label htmlFor="category-filter">Categoria</label>
              <select
                id="category-filter"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="category-select"
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          <ScoreRangeFilter
            minScore={filters.minScore}
            maxScore={filters.maxScore}
            onMinChange={(v) => { setPage(1); setMinScore(v) }}
            onMaxChange={(v) => { setPage(1); setMaxScore(v) }}
          />

          {hasFilters && (
            <button type="button" onClick={handleClearFilters} className="btn-clear-filters">
              Limpar
            </button>
          )}
        </div>

        {isLoading && (
          <div className="stores-loading" role="status">
            <div className="spinner" />
            <p>Carregando lojas...</p>
          </div>
        )}

        {error && (
          <div className="stores-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <StoreList stores={stores} />

            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
              />
            )}
          </>
        )}
      </div>
    </main>
  )
}
