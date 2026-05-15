/**
 * Crawler orchestrator.
 * Registers available scrapers and provides a function to run the full crawl cycle.
 */

import { crawlerService } from '../services/crawler.service.js'
import type { CrawlResult } from '../services/crawler.service.js'

/**
 * Dynamically imports and registers all available scrapers.
 * New scrapers should be imported and registered here.
 */
async function registerScrapers(): Promise<void> {
  try {
    const { LiveloScraper } = await import('./scrapers/livelo.scraper.js')
    crawlerService.registerScraper(new LiveloScraper())
  } catch (error) {
    console.warn('[Crawler] Failed to load LiveloScraper:', error instanceof Error ? error.message : error)
  }

  try {
    const { EsferaScraper } = await import('./scrapers/esfera.scraper.js')
    crawlerService.registerScraper(new EsferaScraper())
  } catch (error) {
    console.warn('[Crawler] Failed to load EsferaScraper:', error instanceof Error ? error.message : error)
  }
}

/**
 * Runs the full crawler cycle:
 * 1. Registers all available scrapers
 * 2. Executes crawlerService.runAll() for all active programs
 * 3. Logs results summary
 *
 * @returns Array of CrawlResult for each program processed
 */
export async function runCrawler(): Promise<CrawlResult[]> {
  console.log('[Crawler] Starting crawl cycle...')
  const startTime = Date.now()

  await registerScrapers()

  const results = await crawlerService.runAll()

  const elapsed = Date.now() - startTime
  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const totalStores = results.reduce((sum, r) => sum + r.storesFound, 0)

  console.log(
    `[Crawler] Crawl cycle completed in ${elapsed}ms — ` +
      `${results.length} programs processed, ` +
      `${successCount} succeeded, ${errorCount} failed, ` +
      `${totalStores} total stores found`
  )

  for (const result of results) {
    if (result.status === 'error') {
      console.error(`[Crawler] Error in "${result.programName}": ${result.errorMessage}`)
    }
  }

  return results
}
