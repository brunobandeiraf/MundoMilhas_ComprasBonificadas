/**
 * Utility functions for normalizing scraped data.
 */

/**
 * Normalizes a store name by trimming whitespace and normalizing unicode characters.
 * Used for consistent comparison and storage.
 */
export function normalizeStoreName(name: string): string {
  return name.trim().normalize('NFC')
}

/**
 * Extracts a numeric score from text in various formats:
 * - "Até 2 pontos por R$1" → 2 (Livelo format, means 2:1)
 * - "5x" → 5
 * - "5 pontos" → 5
 * - "3,5 pontos por R$1" → 3.5
 *
 * Returns null if no valid number can be extracted.
 */
export function parseScore(scoreText: string): number | null {
  const trimmed = scoreText.trim()
  if (!trimmed) return null

  // Try Livelo format first: "Até X pontos por R$1"
  const liveloMatch = trimmed.match(/[Aa]t[ée]\s+(\d+(?:[.,]\d+)?)\s*pont/i)
  if (liveloMatch?.[1]) {
    const numStr = liveloMatch[1].replace(',', '.')
    const value = parseFloat(numStr)
    if (!isNaN(value) && value > 0) return Number.isInteger(value) ? value : value
  }

  // Try "X pontos por R$1" without "Até"
  const pontosMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*pont/i)
  if (pontosMatch?.[1]) {
    const numStr = pontosMatch[1].replace(',', '.')
    const value = parseFloat(numStr)
    if (!isNaN(value) && value > 0) return Number.isInteger(value) ? value : value
  }

  // Try "Xx" format
  const xMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*[xX]/)
  if (xMatch?.[1]) {
    const numStr = xMatch[1].replace(',', '.')
    const value = parseFloat(numStr)
    if (!isNaN(value) && value > 0) return Number.isInteger(value) ? value : value
  }

  // Fallback: match any number
  const match = trimmed.match(/(\d+(?:[.,]\d+)?)/)
  if (!match?.[1]) return null

  const numStr = match[1].replace(',', '.')
  const value = parseFloat(numStr)

  if (isNaN(value) || value <= 0) return null

  return Number.isInteger(value) ? value : value
}
