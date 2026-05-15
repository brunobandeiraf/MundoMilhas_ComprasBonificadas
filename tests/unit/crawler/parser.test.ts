import { describe, it, expect } from 'vitest'
import { normalizeStoreName, parseScore } from '../../../src/crawler/parser.js'

describe('normalizeStoreName', () => {
  it('should trim leading and trailing whitespace', () => {
    expect(normalizeStoreName('  Amazon  ')).toBe('Amazon')
  })

  it('should trim tabs and newlines', () => {
    expect(normalizeStoreName('\tAmazon\n')).toBe('Amazon')
  })

  it('should normalize unicode characters (NFC)', () => {
    // é as two code points (e + combining accent) vs single code point
    const decomposed = 'caf\u0065\u0301' // e + combining acute accent
    const composed = 'caf\u00E9' // precomposed é
    expect(normalizeStoreName(decomposed)).toBe(composed)
  })

  it('should handle empty string', () => {
    expect(normalizeStoreName('')).toBe('')
  })

  it('should preserve internal spaces', () => {
    expect(normalizeStoreName('  Magazine Luiza  ')).toBe('Magazine Luiza')
  })
})

describe('parseScore', () => {
  it('should parse simple integer score', () => {
    expect(parseScore('5')).toBe(5)
  })

  it('should parse score with "x" suffix', () => {
    expect(parseScore('5x')).toBe(5)
  })

  it('should parse score with "pontos" suffix', () => {
    expect(parseScore('5 pontos')).toBe(5)
  })

  it('should parse Livelo format "Até X pontos por R$1"', () => {
    expect(parseScore('Até 2 pontos por R$1')).toBe(2)
  })

  it('should parse Livelo format "Até 10 pontos por R$1"', () => {
    expect(parseScore('Até 10 pontos por R$1')).toBe(10)
  })

  it('should parse Livelo format with decimal "Até 3,5 pontos por R$1"', () => {
    expect(parseScore('Até 3,5 pontos por R$1')).toBe(3.5)
  })

  it('should parse score with "pts" suffix', () => {
    expect(parseScore('10pts')).toBe(10)
  })

  it('should parse decimal score with dot', () => {
    expect(parseScore('3.5x')).toBe(3.5)
  })

  it('should parse decimal score with comma', () => {
    expect(parseScore('3,5 pontos')).toBe(3.5)
  })

  it('should return null for empty string', () => {
    expect(parseScore('')).toBeNull()
  })

  it('should return null for whitespace-only string', () => {
    expect(parseScore('   ')).toBeNull()
  })

  it('should return null for text without numbers', () => {
    expect(parseScore('pontos')).toBeNull()
  })

  it('should return null for zero value', () => {
    expect(parseScore('0x')).toBeNull()
  })

  it('should parse score embedded in text', () => {
    expect(parseScore('Ganhe 7 pontos por real')).toBe(7)
  })

  it('should handle leading whitespace', () => {
    expect(parseScore('  12x  ')).toBe(12)
  })
})
