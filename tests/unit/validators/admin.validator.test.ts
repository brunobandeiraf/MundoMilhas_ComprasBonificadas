import { describe, it, expect } from 'vitest'
import { createUserSchema, createProgramSchema } from '../../../src/validators/admin.validator.js'

describe('createUserSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      name: 'John Doe',
      phone: '5511999887766',
      sendActivationNow: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with only required fields', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      sendActivationNow: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing email', () => {
    const result = createUserSchema.safeParse({
      sendActivationNow: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      sendActivationNow: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects email exceeding 254 characters', () => {
    const longEmail = 'a'.repeat(246) + '@test.com'
    const result = createUserSchema.safeParse({
      email: longEmail,
      sendActivationNow: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 100 characters', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      name: 'a'.repeat(101),
      sendActivationNow: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects phone exceeding 15 digits', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      phone: '1234567890123456',
      sendActivationNow: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects phone with non-digit characters', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      phone: '55-11-99988',
      sendActivationNow: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing sendActivationNow', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
    })
    expect(result.success).toBe(false)
  })
})

describe('createProgramSchema', () => {
  it('accepts valid input', () => {
    const result = createProgramSchema.safeParse({
      name: 'Livelo',
      url: 'https://www.livelo.com.br',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createProgramSchema.safeParse({
      name: '',
      url: 'https://www.livelo.com.br',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL', () => {
    const result = createProgramSchema.safeParse({
      name: 'Livelo',
      url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createProgramSchema.safeParse({
      url: 'https://www.livelo.com.br',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing url', () => {
    const result = createProgramSchema.safeParse({
      name: 'Livelo',
    })
    expect(result.success).toBe(false)
  })
})
