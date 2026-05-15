import { useState, useEffect } from 'react'
import type { StoreItem, StoreDetails } from '../services/api'
import { getStoreDetails } from '../services/api'

interface StoreListProps {
  stores: StoreItem[]
}

export default function StoreList({ stores }: StoreListProps) {
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [details, setDetails] = useState<StoreDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    if (!expandedStoreId) {
      setDetails(null)
      setExpandedProgram(null)
      return
    }
    setLoadingDetails(true)
    setExpandedProgram(null)
    getStoreDetails(expandedStoreId)
      .then(setDetails)
      .catch(() => setDetails(null))
      .finally(() => setLoadingDetails(false))
  }, [expandedStoreId])

  if (stores.length === 0) {
    return (
      <div className="store-list__empty" role="status">
        <p>Nenhuma promoção disponível no momento.</p>
      </div>
    )
  }

  function toggleStore(id: string) {
    setExpandedStoreId((prev) => (prev === id ? null : id))
  }

  function toggleProgram(programName: string) {
    setExpandedProgram((prev) => (prev === programName ? null : programName))
  }

  return (
    <div className="store-list">
      {stores.map((store) => (
        <div
          key={store.id}
          className={`store-card ${expandedStoreId === store.id ? 'store-card--expanded' : ''}`}
        >
          {/* Linha principal da loja */}
          <div
            className="store-card__main"
            onClick={() => toggleStore(store.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') toggleStore(store.id) }}
          >
            {store.imageUrl ? (
              <img src={store.imageUrl} alt={store.name} className="store-card__image" loading="lazy" />
            ) : (
              <div className="store-card__image-placeholder">
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="store-card__name">{store.name}</span>
            <span className="store-card__promo">
              <strong>{store.bestScore} pontos</strong> por R$ 1
            </span>
            <span className="store-card__program-badge">{store.programName}</span>
            <span className="store-card__chevron">
              {expandedStoreId === store.id ? '▲' : '▼'}
            </span>
          </div>

          {/* Nível 1: Lista de programas */}
          {expandedStoreId === store.id && (
            <div className="store-card__programs">
              {loadingDetails ? (
                <p className="store-card__loading">Carregando...</p>
              ) : details ? (
                <>
                  {details.scores
                    .sort((a, b) => b.score - a.score)
                    .map((s) => (
                      <div key={s.programName} className="store-card__program-block">
                        <div
                          className={`store-card__program-row ${expandedProgram === s.programName ? 'store-card__program-row--active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleProgram(s.programName) }}
                          role="button"
                          tabIndex={0}
                        >
                          <span className="store-card__program-name">{s.programName}</span>
                          <span className="store-card__program-score">
                            {s.score} pontos por R$ 1
                          </span>
                          <span className="store-card__program-chevron">
                            {expandedProgram === s.programName ? '▲' : '▼'}
                          </span>
                        </div>

                        {/* Nível 2: Detalhes do programa */}
                        {expandedProgram === s.programName && (
                          <div className="store-card__program-details">
                            {s.description && (
                              <div className="detail-block">
                                <span className="detail-block__label">Descrição</span>
                                <p className="detail-block__text">{s.description}</p>
                              </div>
                            )}
                            {s.rule && (
                              <div className="detail-block">
                                <span className="detail-block__label">Regra</span>
                                <p className="detail-block__text">{s.rule}</p>
                              </div>
                            )}
                            {s.deadline && (
                              <div className="detail-block">
                                <span className="detail-block__label">Prazo</span>
                                <p className="detail-block__text">{s.deadline}</p>
                              </div>
                            )}

                            {/* Gráfico de histórico */}
                            {details.history.filter(h => h.programName === s.programName).length > 0 && (
                              <div className="detail-block">
                                <span className="detail-block__label">Histórico de Pontuação</span>
                                <ScoreChart history={details.history.filter(h => h.programName === s.programName)} />
                              </div>
                            )}

                            {/* Link */}
                            {s.link && (
                              <a
                                href={s.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="store-card__link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Acessar promoção →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </>
              ) : (
                <p className="store-card__loading">Erro ao carregar detalhes</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ScoreChart({ history }: { history: Array<{ date: string; score: number }> }) {
  if (history.length === 0) return null

  const maxScore = Math.max(...history.map((h) => h.score))
  const minScore = Math.min(...history.map((h) => h.score))
  const range = maxScore - minScore || 1

  const width = 100
  const height = 40
  const padding = 2

  const points = history.map((h, i) => {
    const x = padding + (i / Math.max(history.length - 1, 1)) * (width - padding * 2)
    const y = height - padding - ((h.score - minScore) / range) * (height - padding * 2)
    return { x, y, ...h }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <div className="score-chart">
      <div className="score-chart__labels">
        <span>{maxScore}</span>
        <span>{minScore}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="score-chart__svg" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="#1a73e8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#1a73e8" />
        ))}
      </svg>
      <div className="score-chart__dates">
        <span>{history[0]?.date}</span>
        <span>{history[history.length - 1]?.date}</span>
      </div>
    </div>
  )
}
