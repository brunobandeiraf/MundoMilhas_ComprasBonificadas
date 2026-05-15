import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  initiateActivationSchema,
  confirmActivationSchema,
  resendTokenSchema,
} from '../../../src/validators/auth.validator.js'

describe('auth.validator', () => {
  describe('loginSchema', () => {
    it('accepts valid email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'any-password',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'pass' })
      expect(result.success).toBe(false)
    })

    it('rejects email without @', () => {
      const result = loginSchema.safeParse({
        email: 'userexample.com',
        password: 'pass',
      })
      expect(result.success).toBe(false)
    })

    it('rejects email with multiple @', () => {
      const result = loginSchema.safeParse({
        email: 'user@@example.com',
        password: 'pass',
      })
      expect(result.success).toBe(false)
    })

    it('rejects email with empty local part', () => {
      const result = loginSchema.safeParse({
        email: '@example.com',
        password: 'pass',
      })
      expect(result.success).toBe(false)
    })

    it('rejects email with empty domain', () => {
      const result = loginSchema.safeParse({
        email: 'user@',
        password: 'pass',
      })
      expect(result.success).toBe(false)
    })

    it('rejects email exceeding 254 characters', () => {
      const longLocal = 'a'.repeat(245)
      const result = loginSchema.safeParse({
        email: `${longLocal}@example.com`,
        password: 'pass',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('initiateActivationSchema', () => {
    it('accepts valid email', () => {
      const result = initiateActivationSchema.safeParse({
        email: 'user@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = initiateActivationSchema.safeParse({
        email: 'invalid-email',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('confirmActivationSchema', () => {
    const validInput = {
      email: 'user@example.com',
      token: '123456',
      password: 'Abcdef1x',
    }

    it('accepts valid input with required fields only', () => {
      const result = confirmActivationSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('accepts valid input with optional name and phone', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        name: 'John Doe',
        phone: '11999887766',
      })
      expect(result.success).toBe(true)
    })

    it('rejects token with less than 6 digits', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        token: '12345',
      })
      expect(result.success).toBe(false)
    })

    it('rejects token with more than 6 digits', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        token: '1234567',
      })
      expect(result.success).toBe(false)
    })

    it('rejects token with non-digit characters', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        token: '12345a',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password shorter than 8 characters', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        password: 'Ab1cdef',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password without uppercase letter', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        password: 'abcdef1x',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password without lowercase letter', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        password: 'ABCDEF1X',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password without number', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        password: 'Abcdefgh',
      })
      expect(result.success).toBe(false)
    })

    it('rejects name exceeding 100 characters', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        name: 'a'.repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it('rejects phone exceeding 15 characters', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        phone: '1'.repeat(16),
      })
      expect(result.success).toBe(false)
    })

    it('rejects phone with non-digit characters', () => {
      const result = confirmActivationSchema.safeParse({
        ...validInput,
        phone: '1199988-776',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('resendTokenSchema', () => {
    it('accepts valid email', () => {
      const result = resendTokenSchema.safeParse({
        email: 'user@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = resendTokenSchema.safeParse({ email: 'no-at-sign' })
      expect(result.success).toBe(false)
    })
  })
})
