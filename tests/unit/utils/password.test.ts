import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword } from '../../../src/utils/password.js'

describe('password utils', () => {
  it('hashPassword returns a bcrypt hash string', async () => {
    const hash = await hashPassword('MyPassword1')
    expect(hash).toMatch(/^\$2[aby]\$10\$/)
  })

  it('comparePassword returns true for matching password', async () => {
    const password = 'SecurePass123'
    const hash = await hashPassword(password)
    const result = await comparePassword(password, hash)
    expect(result).toBe(true)
  })

  it('comparePassword returns false for non-matching password', async () => {
    const hash = await hashPassword('CorrectPassword1')
    const result = await comparePassword('WrongPassword1', hash)
    expect(result).toBe(false)
  })

  it('hashPassword produces different hashes for the same input', async () => {
    const password = 'SamePassword1'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
  })
})
