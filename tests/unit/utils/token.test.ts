import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock env before importing token utils
vi.mock('../../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    DATABASE_URL: 'file:./test.db',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 587,
    SMTP_USER: 'test',
    SMTP_PASS: 'test',
    CRON_SCHEDULE: '0 10,17 * * *',
  },
}))

import { generateToken, verifyToken, generateActivationToken } from '../../../src/utils/token.js'

describe('token utils', () => {
  describe('generateToken', () => {
    it('generates a valid JWT string', () => {
      const token = generateToken({ userId: '123' })
      expect(token).toBeTypeOf('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('generates a token with custom expiry', () => {
      const token = generateToken({ userId: '123' }, '1h')
      const decoded = verifyToken(token) as Record<string, unknown>
      expect(decoded.userId).toBe('123')
    })
  })

  describe('verifyToken', () => {
    it('decodes a valid token', () => {
      const payload = { userId: 'abc', role: 'admin' }
      const token = generateToken(payload)
      const decoded = verifyToken(token) as Record<string, unknown>
      expect(decoded.userId).toBe('abc')
      expect(decoded.role).toBe('admin')
    })

    it('throws on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow()
    })

    it('throws on expired token', () => {
      const token = generateToken({ userId: '123' }, '0s')
      // Token with 0s expiry is already expired
      expect(() => verifyToken(token)).toThrow()
    })
  })

  describe('generateActivationToken', () => {
    it('generates a 6-digit numeric string', () => {
      const token = generateActivationToken()
      expect(token).toMatch(/^\d{6}$/)
    })

    it('pads with leading zeros when needed', () => {
      // Run multiple times to increase chance of getting a small number
      const tokens = Array.from({ length: 100 }, () => generateActivationToken())
      for (const token of tokens) {
        expect(token).toHaveLength(6)
        expect(token).toMatch(/^\d{6}$/)
      }
    })
  })
})
