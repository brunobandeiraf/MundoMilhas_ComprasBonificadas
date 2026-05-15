import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod/v4'

describe('env config', () => {
  const validEnv = {
    DATABASE_URL: 'file:./dev.db',
    JWT_SECRET: 'test-secret',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user@example.com',
    SMTP_PASS: 'password',
    CRON_SCHEDULE: '0 10,17 * * *',
  }

  describe('envSchema validation', () => {
    const envSchema = z.object({
      DATABASE_URL: z.string().min(1),
      JWT_SECRET: z.string().min(1),
      SMTP_HOST: z.string().min(1),
      SMTP_PORT: z.coerce.number().int().positive(),
      SMTP_USER: z.string().min(1),
      SMTP_PASS: z.string().min(1),
      CRON_SCHEDULE: z.string().default('0 10,17 * * *'),
    })

    it('should accept valid environment variables', () => {
      const result = envSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.DATABASE_URL).toBe('file:./dev.db')
        expect(result.data.JWT_SECRET).toBe('test-secret')
        expect(result.data.SMTP_HOST).toBe('smtp.example.com')
        expect(result.data.SMTP_PORT).toBe(587)
        expect(result.data.SMTP_USER).toBe('user@example.com')
        expect(result.data.SMTP_PASS).toBe('password')
        expect(result.data.CRON_SCHEDULE).toBe('0 10,17 * * *')
      }
    })

    it('should coerce SMTP_PORT from string to number', () => {
      const result = envSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.data.SMTP_PORT).toBe('number')
        expect(result.data.SMTP_PORT).toBe(587)
      }
    })

    it('should use default CRON_SCHEDULE when not provided', () => {
      const { CRON_SCHEDULE, ...envWithoutCron } = validEnv
      const result = envSchema.safeParse(envWithoutCron)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.CRON_SCHEDULE).toBe('0 10,17 * * *')
      }
    })

    it('should reject when DATABASE_URL is empty', () => {
      const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: '' })
      expect(result.success).toBe(false)
    })

    it('should reject when JWT_SECRET is empty', () => {
      const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: '' })
      expect(result.success).toBe(false)
    })

    it('should reject when SMTP_HOST is missing', () => {
      const { SMTP_HOST, ...envWithoutHost } = validEnv
      const result = envSchema.safeParse(envWithoutHost)
      expect(result.success).toBe(false)
    })

    it('should reject when SMTP_PORT is not a valid number', () => {
      const result = envSchema.safeParse({ ...validEnv, SMTP_PORT: 'abc' })
      expect(result.success).toBe(false)
    })

    it('should reject when SMTP_PORT is negative', () => {
      const result = envSchema.safeParse({ ...validEnv, SMTP_PORT: '-1' })
      expect(result.success).toBe(false)
    })

    it('should reject when SMTP_USER is empty', () => {
      const result = envSchema.safeParse({ ...validEnv, SMTP_USER: '' })
      expect(result.success).toBe(false)
    })

    it('should reject when SMTP_PASS is empty', () => {
      const result = envSchema.safeParse({ ...validEnv, SMTP_PASS: '' })
      expect(result.success).toBe(false)
    })
  })
})
