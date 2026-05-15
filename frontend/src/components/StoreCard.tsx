import type { StoreItem } from '../services/api'

interface StoreCardProps {
  store: StoreItem
}

export default function StoreCard({ store }: StoreCardProps) {
  return (
    <article className="store-card" aria-label={`Loja ${store.name}`}>
      <h3 className="store-card__name">{store.name}</h3>
      <p className="store-card__score">
        <span className="store-card__score-value">{store.bestScore}x</span>
      </p>
      <p className="store-card__program">{store.programName}</p>
    </article>
  )
}
