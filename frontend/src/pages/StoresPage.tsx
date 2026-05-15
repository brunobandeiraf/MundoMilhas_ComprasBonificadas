import { useState, useEffect } from 'react'
import { useStores } from '../hooks/useStores'
import { useFilters } from '../hooks/useFilters'
import StoreList from '../components/StoreList'
import Pagination from '../components/Pagination'
import { SearchFilter } from '../components/SearchFilter'
import { ScoreRangeFilter } from '../components/ScoreRangeFilter'
import { getCategories } from '../services/api'

interface ProgramOption {
  id: string
  name: string
}

async function fetchPrograms(): Promise<ProgramOption[]> {
  const token = localStorage.getItem('token')
  if (!token) return []
  const res = await fetch('/api/stores/programs', {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) return []
  return res.json()
}

export default function StoresPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [category, setCategory] = useState('')
  const [program, setProgram] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [categories, setCategories] = useState<string[]>([])
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const { filters, setSearch, setMinScore, setMaxScore, clearFilters } = useFilters()
  const [searchValue, setSearchValue] = useState('')

  const { stores, pagination, isLoading, error } = useStores({
    ...filters,
    category: category || undefined,
    program: program || undefined,
    sortBy,
    page,
    limit,
  })

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
    fetchPrograms().then(setPrograms).catch(() => {})
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

  function handleSortChange(value: string) {
    setSortBy(value)
    setPage(1)
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit)
    setPage(1)
  }

  function handleClearFilters() {
    setSearchValue('')
    setCategory('')
    setProgram('')
    setSortBy('relevance')
    setPage(1)
    clearFilters()
  }

  const hasFilters = !!filters.search || !!category || !!program || sortBy !== 'relevance' || filters.minScore !== undefined || filters.maxScore !== undefined

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

          <div className="filter-program">
            <label htmlFor="program-filter">Programa</label>
            <select
              id="program-filter"
              value={program}
              onChange={(e) => { setProgram(e.target.value); setPage(1) }}
              className="program-select"
            >
              <option value="">Todos</option>
              {programs.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

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

          <div className="filter-sort">
            <label htmlFor="sort-filter">Ordenar por</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="sort-select"
            >
              <option value="relevance">Mais relevantes</option>
              <option value="score_desc">Maior pontuação</option>
              <option value="score_asc">Menor pontuação</option>
              <option value="name_asc">A → Z</option>
              <option value="name_desc">Z → A</option>
            </select>
          </div>

          <ScoreRangeFilter
            minScore={filters.minScore}
            maxScore={filters.maxScore}
            onMinChange={(v) => { setPage(1); setMinScore(v) }}
            onMaxChange={(v) => { setPage(1); setMaxScore(v) }}
          />
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
