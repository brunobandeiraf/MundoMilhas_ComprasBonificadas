interface PaginationProps {
  page: number
  totalPages: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export default function Pagination({ page, totalPages, limit, onPageChange, onLimitChange }: PaginationProps) {
  if (totalPages <= 0) return null

  return (
    <nav className="pagination" aria-label="Navegação de páginas">
      <div className="pagination__controls">
        <button
          className="pagination__button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          ← Anterior
        </button>

        <span className="pagination__info">
          Página {page} de {totalPages}
        </span>

        <button
          className="pagination__button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          Próxima →
        </button>
      </div>

      <div className="pagination__limit">
        <label htmlFor="page-limit">Itens por página:</label>
        <select
          id="page-limit"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="pagination__limit-select"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </nav>
  )
}
