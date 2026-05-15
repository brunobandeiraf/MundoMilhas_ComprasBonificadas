import React from 'react'

interface ScoreRangeFilterProps {
  minScore: number | undefined
  maxScore: number | undefined
  onMinChange: (value: number | undefined) => void
  onMaxChange: (value: number | undefined) => void
}

export function ScoreRangeFilter({
  minScore,
  maxScore,
  onMinChange,
  onMaxChange,
}: ScoreRangeFilterProps) {
  const isInvalidRange =
    minScore !== undefined && maxScore !== undefined && minScore > maxScore

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onMinChange(undefined)
      return
    }
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num >= 1 && num <= 99) {
      onMinChange(num)
    }
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onMaxChange(undefined)
      return
    }
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num >= 1 && num <= 99) {
      onMaxChange(num)
    }
  }

  return (
    <div className="score-range-filter">
      <div className="score-range-filter__field">
        <label htmlFor="min-score-input">Mínimo</label>
        <input
          id="min-score-input"
          type="number"
          min={1}
          max={99}
          value={minScore ?? ''}
          onChange={handleMinChange}
          placeholder="Mín"
          aria-label="Pontuação mínima"
        />
      </div>
      <div className="score-range-filter__field">
        <label htmlFor="max-score-input">Máximo</label>
        <input
          id="max-score-input"
          type="number"
          min={1}
          max={99}
          value={maxScore ?? ''}
          onChange={handleMaxChange}
          placeholder="Máx"
          aria-label="Pontuação máxima"
        />
      </div>
      {isInvalidRange && (
        <p className="score-range-filter__error" role="alert">
          Faixa inválida: mínimo maior que máximo
        </p>
      )}
    </div>
  )
}
