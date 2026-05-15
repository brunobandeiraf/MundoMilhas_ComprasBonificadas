import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockProgram = {
  id: 'program-1',
  name: 'Livelo',
  url: 'https://www.livelo.com.br',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockFindMany = vi.fn()
const mockCreate = vi.fn()

vi.mock('../../../src/config/database.js', () => ({
  db: {
    loyaltyProgram: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

import { programService } from '../../../src/services/program.service.js'
import { ConflictError } from '../../../src/middleware/errorHandler.js'

describe('programService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listPrograms', () => {
    it('returns all active programs ordered by createdAt desc', async () => {
      const programs = [mockProgram, { ...mockProgram, id: 'program-2', name: 'Smiles' }]
      mockFindMany.mockResolvedValue(programs)

      const result = await programService.listPrograms()

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toEqual(programs)
    })

    it('returns empty array when no active programs exist', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await programService.listPrograms()

      expect(result).toEqual([])
    })
  })

  describe('createProgram', () => {
    it('creates a program when name is unique', async () => {
      mockFindMany.mockResolvedValue([])
      mockCreate.mockResolvedValue(mockProgram)

      const result = await programService.createProgram({
        name: 'Livelo',
        url: 'https://www.livelo.com.br',
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: 'Livelo',
          url: 'https://www.livelo.com.br',
        },
      })
      expect(result).toEqual(mockProgram)
    })

    it('throws ConflictError when program name already exists', async () => {
      mockFindMany.mockResolvedValue([mockProgram])

      await expect(
        programService.createProgram({
          name: 'Livelo',
          url: 'https://other-url.com',
        })
      ).rejects.toThrow(ConflictError)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('throws ConflictError for case-insensitive duplicate name', async () => {
      mockFindMany.mockResolvedValue([mockProgram])

      await expect(
        programService.createProgram({
          name: 'LIVELO',
          url: 'https://other-url.com',
        })
      ).rejects.toThrow(ConflictError)

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('findByName', () => {
    it('returns program when found with exact name', async () => {
      mockFindMany.mockResolvedValue([mockProgram])

      const result = await programService.findByName('Livelo')

      expect(result).toEqual(mockProgram)
    })

    it('returns program with case-insensitive match', async () => {
      mockFindMany.mockResolvedValue([mockProgram])

      const result = await programService.findByName('livelo')

      expect(result).toEqual(mockProgram)
    })

    it('returns null when program not found', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await programService.findByName('NonExistent')

      expect(result).toBeNull()
    })
  })
})
