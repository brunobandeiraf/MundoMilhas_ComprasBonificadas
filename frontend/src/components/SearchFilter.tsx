import React from 'react'

interface SearchFilterProps {
  value: string
  onChange: (value: string) => void
}

export function SearchFilter({ value, onChange }: SearchFilterProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, 100)
    onChange(newValue)
  }

  return (
    <div className="search-filter">
      <label htmlFor="search-input">Buscar loja</label>
      <div className="search-filter__input-wrapper">
        <input
          id="search-input"
          type="text"
          value={value}
          onChange={handleChange}
          maxLength={100}
          placeholder="Buscar loja..."
          aria-label="Buscar loja por nome"
        />
      </div>
    </div>
  )
}
