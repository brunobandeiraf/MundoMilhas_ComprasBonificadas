interface NoResultsProps {
  message?: string
}

export function NoResults({ message = 'Nenhum resultado encontrado para os filtros aplicados.' }: NoResultsProps) {
  return (
    <div className="no-results" role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  )
}
