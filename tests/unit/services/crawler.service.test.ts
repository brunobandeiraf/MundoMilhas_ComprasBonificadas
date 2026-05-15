import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockProgram = {
  id: 'program-1',
  name: 'Livelo',
  url: 'https://www.livelo.com.br',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockLoyaltyProgramFindUnique = vi.fn()
const mockStoreFindMany = vi.fn()
const mockStoreUpsert = vi.fn()
const mockBonusScoreUpsert = vi.fn()
const mockBonusScoreDeleteMany = vi.fn()
const mockCrawlLogCreate = vi.fn()

vi.mock('../../../src/config/database.js', () => ({
  db: {
    loyaltyProgram: {
      findUnique: (...args: unknown[]) => mockLoyaltyProgramFindUnique(...args),
    },
    store: {
      upsert: (...args: unknown[]) => mockStoreUpsert(...args),
      findMany: (...args: unknown[]) => mockStoreFindMany(...args),
    },
    bonusScore: {
      upsert: (...args: unknown[]) => mockBonusScoreUpsert(...args),
      deleteMany: (...args: unknown[]) => mockBonusScoreDeleteMany(...args),
    },
    crawlLog: {
      create: (...args: unknown[]) => mockCrawlLogCreate(...args),
    },
  },
}))

const mockListPrograms = vi.fn()

vi.mock('../../../src/services/program.service.js', () => ({
  programService: {
    listPrograms: (...args: unknown[]) => mockListPrograms(...args),
  },
}))

import { crawlerService } from '../../../src/services/crawler.service.js'
import type { BaseScraper } from '../../../src/services/crawler.service.js'

describe('crawlerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    crawlerService.clearScrapers()
  })

  describe('registerScraper / getScraper', () => {
    it('registers and retrieves a scraper by program name', () => {
      const scraper: BaseScraper = {
        programName: 'Livelo',
        scrape: vi.fn(),
      }

      crawlerService.registerScraper(scraper)

      expect(crawlerService.getScraper('Livelo')).toBe(scraper)
    })

    it('retrieves scraper case-insensitively', () => {
      const scraper: BaseScraper = {
        programName: 'Livelo',
        scrape: vi.fn(),
      }

      crawlerService.registerScraper(scraper)

      expect(crawlerService.getScraper('livelo')).toBe(scraper)
      expect(crawlerService.getScraper('LIVELO')).toBe(scraper)
    })

    it('returns undefined for unregistered program', () => {
      expect(crawlerService.getScraper('NonExistent')).toBeUndefined()
    })
  })

  describe('runForProgram', () => {
    it('returns error when program is not found', async () => {
      mockLoyaltyProgramFindUnique.mockResolvedValue(null)

      const result = await crawlerService.runForProgram('non-existent-id')

      expect(result.status).toBe('error')
      expect(result.programName).toBe('Unknown')
      expect(result.storesFound).toBe(0)
      expect(result.errorMessage).toContain('não encontrado')
      expect(mockCrawlLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'error',
            programId: 'non-existent-id',
          }),
        })
      )
    })

    it('returns error when no scraper is registered for the program', async () => {
      mockLoyaltyProgramFindUnique.mockResolvedValue(mockProgram)

      const result = await crawlerService.runForProgram('program-1')

      expect(result.status).toBe('error')
      expect(result.programName).toBe('Livelo')
      expect(result.errorMessage).toContain('Nenhum scraper registrado')
      expect(mockCrawlLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'error',
            programId: 'program-1',
            programName: 'Livelo',
          }),
        })
      )
    })

    it('processes scraper results successfully: upserts stores and scores', async () => {
      mockLoyaltyProgramFindUnique.mockResolvedValue(mockProgram)

      const scraper: BaseScraper = {
        programName: 'Livelo',
        scrape: vi.fn().mockResolvedValue([
          { storeName: 'Amazon', score: 5 },
          { storeName: 'Magazine Luiza', score: 8 },
        ]),
      }
      crawlerService.registerScraper(scraper)

      mockStoreUpsert
        .mockResolvedValueOnce({ id: 'store-1', name: 'Amazon' })
        .mockResolvedValueOnce({ id: 'store-2', name: 'Magazine Luiza' })
      mockBonusScoreUpsert.mockResolvedValue({})
      mockStoreFindMany.mockResolvedValue([
        { id: 'store-1' },
        { id: 'store-2' },
      ])
      mockBonusScoreDeleteMany.mockResolvedValue({ count: 0 })
      mockCrawlLogCreate.mockResolvedValue({})

      const result = await crawlerService.runForProgram('program-1')

      expect(result.status).toBe('success')
      expect(result.storesFound).toBe(2)
      expect(result.programName).toBe('Livelo')
      expect(result.duration).toBeGreaterThanOrEqual(0)

      // Verify stores were upserted
      expect(mockStoreUpsert).toHaveBeenCalledTimes(2)

      // Verify scores were upserted
      expect(mockBonusScoreUpsert).toHaveBeenCalledTimes(2)

      // Verify absent stores' scores were cleaned up
      expect(mockBonusScoreDeleteMany).toHaveBeenCalledWith({
        where: {
          programId: 'program-1',
          storeId: { notIn: ['store-1', 'store-2'] },
        },
      })

      // Verify success was logged
      expect(mockCrawlLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'success',
            storesFound: 2,
            programId: 'program-1',
            programName: 'Livelo',
          }),
        })
      )
    })

    it('removes all scores for program when scraper returns empty list', async () => {
      mockLoyaltyProgramFindUnique.mockResolvedValue(mockProgram)

      const scraper: BaseScraper = {
        programName: 'Livelo',
        scrape: vi.fn().mockResolvedValue([]),
      }
      crawlerService.registerScraper(scraper)

      mockBonusScoreDeleteMany.mockResolvedValue({ count: 3 })
      mockCrawlLogCreate.mockResolvedValue({})

      const result = await crawlerService.runForProgram('program-1')

      expect(result.status).toBe('success')
      expect(result.storesFound).toBe(0)
      expect(mockBonusScoreDeleteMany).toHaveBeenCalledWith({
        where: { programId: 'program-1' },
      })
    })

    it('handles scraper failure: logs error and discards partial data', async () => {
      mockLoyaltyProgramFindUnique.mockResolvedValue(mockProgram)

      const scraper: BaseScraper = {
        programName: 'Livelo',
        scrape: vi.fn().mockRejectedValue(new Error('Timeout ao acessar site')),
      }
      crawlerService.registerScraper(scraper)

      mockCrawlLogCreate.mockResolvedValue({})

      const result = await crawlerService.runForProgram('program-1')

      expect(result.status).toBe('error')
      expect(result.storesFound).toBe(0)
      expect(result.errorMessage).toBe('Timeout ao acessar site')
      expect(result.programName).toBe('Livelo')

      // Verify no store/score operations were performed
      expect(mockStoreUpsert).not.toHaveBeenCalled()
      expect(mockBonusScoreUpsert).not.toHaveBeenCalled()
      expect(mockBonusScoreDeleteMany).not.toHaveBeenCalled()

      // Verify error was logged
      expect(mockCrawlLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'error',
            errorMessage: 'Timeout ao acessar site',
          }),
        })
      )
    })
  })

  describe('runAll', () => {
    it('runs scrapers for all active programs', async () => {
      const program2 = { ...mockProgram, id: 'program-2', name: 'Smiles' }
      mockListPrograms.mockResolvedValue([mockProgram, program2])

      // Both programs have no scraper registered, so both will error
      mockLoyaltyProgramFindUnique
        .mockResolvedValueOnce(mockProgram)
        .mockResolvedValueOnce(program2)
      mockCrawlLogCreate.mockResolvedValue({})

      const results = await crawlerService.runAll()

      expect(results).toHaveLength(2)
      expect(results[0].programId).toBe('program-1')
      expect(results[0].status).toBe('error')
      expect(results[1].programId).toBe('program-2')
      expect(results[1].status).toBe('error')
    })

    it('isolates failures: one program failing does not affect others', async () => {
      const program2 = { ...mockProgram, id: 'program-2', name: 'Smiles' }
      mockListPrograms.mockResolvedValue([mockProgram, program2])

      // Register scraper for Livelo that fails
      const failingScraper: BaseScraper = {
        programName: 'Livelo',
        scrape: vi.fn().mockRejectedValue(new Error('Connection failed')),
      }
      crawlerService.registerScraper(failingScraper)

      // Register scraper for Smiles that succeeds
      const successScraper: BaseScraper = {
        programName: 'Smiles',
        scrape: vi.fn().mockResolvedValue([{ storeName: 'Amazon', score: 3 }]),
      }
      crawlerService.registerScraper(successScraper)

      mockLoyaltyProgramFindUnique
        .mockResolvedValueOnce(mockProgram)
        .mockResolvedValueOnce(program2)
      mockStoreUpsert.mockResolvedValue({ id: 'store-1', name: 'Amazon' })
      mockBonusScoreUpsert.mockResolvedValue({})
      mockStoreFindMany.mockResolvedValue([{ id: 'store-1' }])
      mockBonusScoreDeleteMany.mockResolvedValue({ count: 0 })
      mockCrawlLogCreate.mockResolvedValue({})

      const results = await crawlerService.runAll()

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe('error')
      expect(results[0].programName).toBe('Livelo')
      expect(results[1].status).toBe('success')
      expect(results[1].programName).toBe('Smiles')
      expect(results[1].storesFound).toBe(1)
    })

    it('returns empty array when no active programs exist', async () => {
      mockListPrograms.mockResolvedValue([])

      const results = await crawlerService.runAll()

      expect(results).toEqual([])
    })
  })
})
