import { db } from '../config/database.js'
import { programService } from './program.service.js'

/**
 * Result of a single scraper execution for a program.
 */
export interface ScraperResult {
  storeName: string
  score: number
  imageUrl?: string
  category?: string
  description?: string
  link?: string
  rule?: string
  deadline?: string
}

/**
 * Interface that all scrapers must implement.
 */
export interface BaseScraper {
  programName: string
  scrape(): Promise<ScraperResult[]>
}

/**
 * Result of a crawl operation for a single program.
 */
export interface CrawlResult {
  programId: string
  programName: string
  status: 'success' | 'error'
  storesFound: number
  errorMessage?: string
  duration: number
}

/**
 * Registry mapping program names (lowercase) to their scraper implementations.
 */
const scraperRegistry = new Map<string, BaseScraper>()

export const crawlerService = {
  /**
   * Register a scraper for a given program name.
   * The name is stored lowercase for case-insensitive matching.
   */
  registerScraper(scraper: BaseScraper): void {
    scraperRegistry.set(scraper.programName.toLowerCase(), scraper)
  },

  /**
   * Get a registered scraper by program name (case-insensitive).
   */
  getScraper(programName: string): BaseScraper | undefined {
    return scraperRegistry.get(programName.toLowerCase())
  },

  /**
   * Clear all registered scrapers (useful for testing).
   */
  clearScrapers(): void {
    scraperRegistry.clear()
  },

  /**
   * Track which programs are currently running to prevent duplicate executions.
   */
  isRunning: new Set<string>(),

  /**
   * Run crawlers for all active programs.
   * Livelo always runs first (other programs depend on its stores being created first).
   */
  async runAll(): Promise<CrawlResult[]> {
    const programs = await programService.listPrograms()
    // Sort: Livelo first, then alphabetical
    const sorted = [...programs].sort((a, b) => {
      if (a.name === 'Livelo') return -1
      if (b.name === 'Livelo') return 1
      return a.name.localeCompare(b.name)
    })

    console.log(`[CrawlerService] Ordem de execução: ${sorted.map(p => p.name).join(' → ')}`)

    const results: CrawlResult[] = []

    for (const program of sorted) {
      console.log(`[CrawlerService] Iniciando: ${program.name}`)
      const result = await crawlerService.runForProgram(program.id)
      console.log(`[CrawlerService] Concluído: ${program.name} (${result.status})`)
      results.push(result)
    }

    return results
  },

  /**
   * Run the crawler for a specific program.
   * On success: upsert stores, update scores, remove absent stores' scores.
   * On failure: discard partial data, keep previous data, log error.
   */
  async runForProgram(programId: string): Promise<CrawlResult> {
    // Prevent duplicate execution
    if (crawlerService.isRunning.has(programId)) {
      return {
        programId,
        programName: 'Unknown',
        status: 'error',
        storesFound: 0,
        errorMessage: 'Este programa já está em execução. Aguarde a conclusão.',
        duration: 0,
      }
    }

    crawlerService.isRunning.add(programId)
    const startedAt = new Date()

    try {
    // Find the program
    const program = await db.loyaltyProgram.findUnique({
      where: { id: programId },
    })

    if (!program) {
      const duration = Date.now() - startedAt.getTime()
      const result: CrawlResult = {
        programId,
        programName: 'Unknown',
        status: 'error',
        storesFound: 0,
        errorMessage: `Programa com id ${programId} não encontrado`,
        duration,
      }

      await db.crawlLog.create({
        data: {
          programId,
          programName: 'Unknown',
          status: 'error',
          storesFound: 0,
          errorMessage: result.errorMessage,
          startedAt,
        },
      })

      return result
    }

    // Check if a scraper is registered for this program
    const scraper = crawlerService.getScraper(program.name)

    if (!scraper) {
      const duration = Date.now() - startedAt.getTime()
      const result: CrawlResult = {
        programId: program.id,
        programName: program.name,
        status: 'error',
        storesFound: 0,
        errorMessage: `Nenhum scraper registrado para o programa "${program.name}"`,
        duration,
      }

      console.warn(`[CrawlerService] ${result.errorMessage}`)

      await db.crawlLog.create({
        data: {
          programId: program.id,
          programName: program.name,
          status: 'error',
          storesFound: 0,
          errorMessage: result.errorMessage,
          startedAt,
        },
      })

      return result
    }

    try {
      // Execute the scraper
      const scraperResults = await scraper.scrape()

      // Process results: upsert stores and update scores
      const storeNames: string[] = []

      for (const item of scraperResults) {
        // Check if store already exists
        const existingStore = await db.store.findFirst({
          where: { name: item.storeName },
        })

        // Upsert store - only set category if store is new or has no category
        // New stores from non-Livelo programs get "Outros" as default category
        const defaultCategory = existingStore?.category || item.category || 'Outros'

        const store = await db.store.upsert({
          where: { name: item.storeName },
          create: {
            name: item.storeName,
            imageUrl: item.imageUrl || null,
            category: item.category || 'Outros',
            description: item.description || null,
            link: item.link || null,
          },
          update: {
            updatedAt: new Date(),
            imageUrl: item.imageUrl || undefined,
            // Never overwrite existing category
            description: item.description || undefined,
            link: item.link || undefined,
          },
        })

        // Upsert current score
        await db.bonusScore.upsert({
          where: {
            storeId_programId: {
              storeId: store.id,
              programId: program.id,
            },
          },
          create: {
            storeId: store.id,
            programId: program.id,
            score: item.score,
            description: item.description || null,
            rule: item.rule || null,
            deadline: item.deadline || null,
            link: item.link || null,
          },
          update: {
            score: item.score,
            description: item.description || undefined,
            rule: item.rule || undefined,
            deadline: item.deadline || undefined,
            link: item.link || undefined,
            collectedAt: new Date(),
          },
        })

        // Save daily history (one entry per day)
        const today = new Date().toISOString().split('T')[0]!
        await db.scoreHistory.upsert({
          where: {
            storeId_programId_date: {
              storeId: store.id,
              programId: program.id,
              date: today,
            },
          },
          create: {
            storeId: store.id,
            programId: program.id,
            score: item.score,
            date: today,
          },
          update: {
            score: item.score,
          },
        })

        storeNames.push(item.storeName)
      }

      // Remove scores for stores not in the collected list (for this program only)
      if (storeNames.length > 0) {
        const storesToKeep = await db.store.findMany({
          where: { name: { in: storeNames } },
          select: { id: true },
        })
        const storeIdsToKeep = storesToKeep.map((s) => s.id)

        await db.bonusScore.deleteMany({
          where: {
            programId: program.id,
            storeId: { notIn: storeIdsToKeep },
          },
        })
      } else {
        // If no stores were collected, remove all scores for this program
        await db.bonusScore.deleteMany({
          where: { programId: program.id },
        })
      }

      const duration = Date.now() - startedAt.getTime()
      const result: CrawlResult = {
        programId: program.id,
        programName: program.name,
        status: 'success',
        storesFound: scraperResults.length,
        duration,
      }

      // Log success
      await db.crawlLog.create({
        data: {
          programId: program.id,
          programName: program.name,
          status: 'success',
          storesFound: scraperResults.length,
          startedAt,
        },
      })

      return result
    } catch (error) {
      // On failure: discard partial data (transaction not committed), log error
      const duration = Date.now() - startedAt.getTime()
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido'

      const result: CrawlResult = {
        programId: program.id,
        programName: program.name,
        status: 'error',
        storesFound: 0,
        errorMessage,
        duration,
      }

      // Log error
      await db.crawlLog.create({
        data: {
          programId: program.id,
          programName: program.name,
          status: 'error',
          storesFound: 0,
          errorMessage,
          startedAt,
        },
      })

      return result
    }
    } finally {
      crawlerService.isRunning.delete(programId)
    }
  },
}
