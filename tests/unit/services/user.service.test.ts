import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  phone: '11999999999',
  passwordHash: null,
  role: 'client',
  isActive: false,
  activationToken: null,
  tokenExpiresAt: null,
  tokenResendCount: 0,
  tokenResendResetAt: null,
  loginAttempts: 0,
  loginBlockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockFindFirst = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../../../src/config/database.js', () => ({
  db: {
    user: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

import { UserService } from '../../../src/services/user.service.js'
import { ConflictError } from '../../../src/middleware/errorHandler.js'

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createUser', () => {
    it('creates a user when email is not taken', async () => {
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ ...mockUser, email: 'new@example.com' })

      const result = await UserService.createUser({
        email: 'New@Example.com',
        name: 'New User',
        sendActivationNow: false,
      })

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      })
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          name: 'New User',
          phone: null,
        },
      })
      expect(result.email).toBe('new@example.com')
    })

    it('throws ConflictError when email already exists', async () => {
      mockFindFirst.mockResolvedValue(mockUser)

      await expect(
        UserService.createUser({
          email: 'test@example.com',
          sendActivationNow: false,
        })
      ).rejects.toThrow(ConflictError)
    })

    it('normalizes email to lowercase', async () => {
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ ...mockUser, email: 'user@test.com' })

      await UserService.createUser({
        email: 'USER@TEST.COM',
        sendActivationNow: true,
      })

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      })
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          email: 'user@test.com',
          name: null,
          phone: null,
        },
      })
    })
  })

  describe('findByEmail', () => {
    it('returns user when found', async () => {
      mockFindFirst.mockResolvedValue(mockUser)

      const result = await UserService.findByEmail('test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('returns null when user not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await UserService.findByEmail('notfound@example.com')

      expect(result).toBeNull()
    })

    it('performs case-insensitive search by normalizing email', async () => {
      mockFindFirst.mockResolvedValue(mockUser)

      await UserService.findByEmail('TEST@EXAMPLE.COM')

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })
  })

  describe('updateProfile', () => {
    it('updates name and phone for a given userId', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name', phone: '11888888888' }
      mockUpdate.mockResolvedValue(updatedUser)

      const result = await UserService.updateProfile('user-1', {
        name: 'Updated Name',
        phone: '11888888888',
      })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name', phone: '11888888888' },
      })
      expect(result.name).toBe('Updated Name')
      expect(result.phone).toBe('11888888888')
    })
  })

  describe('incrementLoginAttempts', () => {
    it('increments login attempts and returns new count', async () => {
      mockFindFirst.mockResolvedValue({ ...mockUser, loginAttempts: 2 })
      mockUpdate.mockResolvedValue({ ...mockUser, loginAttempts: 3 })

      const result = await UserService.incrementLoginAttempts('test@example.com')

      expect(result).toBe(3)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loginAttempts: 3 },
      })
    })

    it('sets loginBlockedUntil when attempts reach 5', async () => {
      mockFindFirst.mockResolvedValue({ ...mockUser, loginAttempts: 4 })
      mockUpdate.mockResolvedValue({ ...mockUser, loginAttempts: 5 })

      const beforeCall = Date.now()
      const result = await UserService.incrementLoginAttempts('test@example.com')
      const afterCall = Date.now()

      expect(result).toBe(5)
      const updateCall = mockUpdate.mock.calls[0][0]
      expect(updateCall.data.loginAttempts).toBe(5)
      expect(updateCall.data.loginBlockedUntil).toBeInstanceOf(Date)

      const blockTime = updateCall.data.loginBlockedUntil.getTime()
      const expectedMin = beforeCall + 15 * 60 * 1000
      const expectedMax = afterCall + 15 * 60 * 1000
      expect(blockTime).toBeGreaterThanOrEqual(expectedMin)
      expect(blockTime).toBeLessThanOrEqual(expectedMax)
    })

    it('returns 0 when user not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await UserService.incrementLoginAttempts('notfound@example.com')

      expect(result).toBe(0)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('does not set block when attempts are below 5', async () => {
      mockFindFirst.mockResolvedValue({ ...mockUser, loginAttempts: 3 })
      mockUpdate.mockResolvedValue({ ...mockUser, loginAttempts: 4 })

      await UserService.incrementLoginAttempts('test@example.com')

      const updateCall = mockUpdate.mock.calls[0][0]
      expect(updateCall.data.loginAttempts).toBe(4)
      expect(updateCall.data.loginBlockedUntil).toBeUndefined()
    })
  })

  describe('resetLoginAttempts', () => {
    it('resets login attempts and clears block', async () => {
      mockFindFirst.mockResolvedValue({ ...mockUser, loginAttempts: 5, loginBlockedUntil: new Date() })
      mockUpdate.mockResolvedValue({ ...mockUser, loginAttempts: 0, loginBlockedUntil: null })

      await UserService.resetLoginAttempts('test@example.com')

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { loginAttempts: 0, loginBlockedUntil: null },
      })
    })

    it('does nothing when user not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      await UserService.resetLoginAttempts('notfound@example.com')

      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('isLoginBlocked', () => {
    it('returns true when loginBlockedUntil is in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000)
      mockFindFirst.mockResolvedValue({ ...mockUser, loginBlockedUntil: futureDate })

      const result = await UserService.isLoginBlocked('test@example.com')

      expect(result).toBe(true)
    })

    it('returns false when loginBlockedUntil is in the past', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000)
      mockFindFirst.mockResolvedValue({ ...mockUser, loginBlockedUntil: pastDate })

      const result = await UserService.isLoginBlocked('test@example.com')

      expect(result).toBe(false)
    })

    it('returns false when loginBlockedUntil is null', async () => {
      mockFindFirst.mockResolvedValue({ ...mockUser, loginBlockedUntil: null })

      const result = await UserService.isLoginBlocked('test@example.com')

      expect(result).toBe(false)
    })

    it('returns false when user not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await UserService.isLoginBlocked('notfound@example.com')

      expect(result).toBe(false)
    })
  })
})
