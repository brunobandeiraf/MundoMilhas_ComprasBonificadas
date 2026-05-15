/// <reference lib="dom" />

import puppeteer, { type Browser, type Page } from 'puppeteer'
import type { BaseScraper, ScraperResult } from './base.scraper.js'

const ESFERA_URL = 'https://www.esfera.com.vc/junte-pontos/junte-pontos/esf02163'
const TIMEOUT_MS = 120_000

/**
 * Scraper for the Esfera loyalty program.
 *
 * HTML structure:
 * - Store name: <p class="font-open-sans leading-normal text-grey-darker tracking-tight">Adidas</p>
 * - Score: <p class="font-poppins leading-tight text-sm font-normal text-alert-success-dark tracking-tight">Ganhe 4 pts a cada real</p>
 *   → Extract number → score = 4
 */
export class EsferaScraper implements BaseScraper {
  programName = 'Esfera'

  private url: string
  private timeout: number

  constructor(url: string = ESFERA_URL, timeout: number = TIMEOUT_MS) {
    this.url = url
    this.timeout = timeout
  }

  async scrape(): Promise<ScraperResult[]> {
    let browser: Browser | null = null

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      })

      const page = await browser.newPage()

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })

      page.setDefaultTimeout(this.timeout)
      page.setDefaultNavigationTimeout(this.timeout)
      await page.setViewport({ width: 1280, height: 800 })

      console.log(`[EsferaScraper] Acessando ${this.url}...`)

      await page.goto(this.url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      })

      console.log('[EsferaScraper] Página carregada, aguardando cards...')

      // Wait for store cards to appear
      await this.waitForCards(page)

      // Scroll to load all content
      await this.scrollToBottom(page)

      console.log('[EsferaScraper] Extraindo lojas...')

      const results = await this.extractStores(page)

      console.log(`[EsferaScraper] ${results.length} lojas encontradas.`)

      // Only fetch details on first run - wrapped in try/catch so failures don't lose store data
      try {
        const { db } = await import('../../config/database.js')
        const esferaProgram = await db.loyaltyProgram.findFirst({ where: { name: 'Esfera' } })
        const scoresWithRules = esferaProgram ? await db.bonusScore.count({
          where: {
            rule: { not: null },
            programId: esferaProgram.id,
          },
        }) : 0

        if (scoresWithRules < 10 && results.some(r => r.link)) {
          console.log(`[EsferaScraper] Buscando detalhes (${scoresWithRules} com regras)...`)
          const detailsPage = await browser!.newPage()
          await detailsPage.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          )
          detailsPage.setDefaultTimeout(20_000)
          detailsPage.setDefaultNavigationTimeout(20_000)

          let detailsCount = 0
          let errors = 0
          for (const store of results) {
            if (!store.link) continue
            if (errors >= 5) {
              console.log('[EsferaScraper] Muitos erros seguidos, parando busca de detalhes.')
              break
            }
            try {
              const ruleHtml = await this.fetchStoreRules(detailsPage, store.link)
              if (ruleHtml) { store.rule = ruleHtml; errors = 0 }
              detailsCount++
              if (detailsCount % 20 === 0) {
                console.log(`[EsferaScraper] Detalhes: ${detailsCount}/${results.filter(r => r.link).length}`)
              }
            } catch (e) {
              errors++
              if (e instanceof Error && e.message.includes('closed')) break
            }
          }
          try { await detailsPage.close() } catch {}
          console.log(`[EsferaScraper] Detalhes coletados para ${detailsCount} lojas.`)
        } else {
          console.log(`[EsferaScraper] Detalhes já coletados (${scoresWithRules}). Apenas atualizando pontuações.`)
        }
      } catch (detailsError) {
        console.warn('[EsferaScraper] Erro ao buscar detalhes (lojas serão salvas sem regras):', detailsError instanceof Error ? detailsError.message : detailsError)
      }

      await detailsPage.close()
      console.log(`[EsferaScraper] Detalhes coletados para ${detailsCount} lojas.`)

      return results
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          throw new Error(`Timeout após ${this.timeout / 1000}s ao acessar ${this.url}`)
        }
        if (error.message.includes('net::') || error.message.includes('ECONNREFUSED')) {
          throw new Error(`Erro de conexão ao acessar ${this.url}`)
        }
        throw new Error(`Erro durante scraping: ${error.message}`)
      }
      throw new Error('Erro desconhecido durante scraping')
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }

  private async waitForCards(page: Page): Promise<void> {
    try {
      await page.waitForSelector('[class*="grey-darker"]', { timeout: 30_000 })
    } catch {}
    await new Promise((r) => setTimeout(r, 5000))
  }

  private async scrollToBottom(page: Page): Promise<void> {
    // Only scroll - don't click anything to avoid navigation
    let previousCount = 0
    let stableRounds = 0

    for (let i = 0; i < 30; i++) {
      try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      } catch {
        break // Context destroyed, stop scrolling
      }

      await new Promise((r) => setTimeout(r, 1500))

      try {
        const currentCount = await page.evaluate(() =>
          document.querySelectorAll('[class*="grey-darker"]').length
        )

        if (currentCount === previousCount) {
          stableRounds++
          if (stableRounds >= 3) break
        } else {
          stableRounds = 0
        }
        previousCount = currentCount
      } catch {
        break // Context destroyed
      }
    }

    await new Promise((r) => setTimeout(r, 2000))
    console.log(`[EsferaScraper] Scroll finalizado. Elementos: ${previousCount}`)
  }

  private async extractStores(page: Page): Promise<ScraperResult[]> {
    const results = await page.evaluate(() => {
      const collected: Array<{ storeName: string; score: number; link?: string; imageUrl?: string }> = []

      // Main strategy: Find all <a> cards that contain both img and score text
      const cards = document.querySelectorAll('a[href*="/p/"]')

      for (const card of cards) {
        try {
          // Get store name from p.text-grey-darker
          const nameEl = card.querySelector('[class*="grey-darker"]')
          if (!nameEl) continue

          const storeName = (nameEl.textContent || '').trim()
          if (!storeName || storeName.length > 100 || storeName.length < 2) continue

          // Get score from p with success class
          const scoreEl = card.querySelector('[class*="alert-success"], [class*="success-dark"], [class*="success"]')
          if (!scoreEl) continue

          const scoreText = (scoreEl.textContent || '').trim()
          const scoreMatch = scoreText.match(/(\d+(?:[.,]\d+)?)\s*(?:pts|pontos|ponto)/i)
          if (!scoreMatch?.[1]) continue

          const score = parseFloat(scoreMatch[1].replace(',', '.'))
          if (isNaN(score) || score <= 0) continue

          // Get link from the <a> href
          let link: string | undefined
          const href = card.getAttribute('href') || ''
          if (href.startsWith('/') || href.startsWith('http')) {
            link = href.startsWith('/') ? `https://www.esfera.com.vc${href}` : href
          }

          // Get image URL from <img> inside the card
          let imageUrl: string | undefined
          const img = card.querySelector('img')
          if (img) {
            // Prefer src attribute (full URL)
            const src = img.getAttribute('src') || ''
            if (src && !src.startsWith('data:')) {
              // If it's a relative /_next/image URL, make it absolute
              imageUrl = src.startsWith('/') ? `https://www.esfera.com.vc${src}` : src
            }
          }

          // Avoid duplicates
          const exists = collected.some(
            (r) => r.storeName.toLowerCase() === storeName.toLowerCase()
          )
          if (exists) continue

          collected.push({ storeName, score: Number.isInteger(score) ? score : score, link, imageUrl })
        } catch {
          continue
        }
      }

      // Fallback: Strategy 2 - text-center containers (if <a> strategy found nothing)
      if (collected.length < 20) {
        const containers = document.querySelectorAll('.text-center, [class*="flex-1"]')

        for (const container of containers) {
          try {
            const nameEl = container.querySelector('[class*="grey-darker"]')
            if (!nameEl) continue

            const storeName = (nameEl.textContent || '').trim()
            if (!storeName || storeName.length > 100 || storeName.length < 2) continue

            const scoreEl = container.querySelector('[class*="alert-success"], [class*="success"]')
            if (!scoreEl) continue

            const scoreText = (scoreEl.textContent || '').trim()
            const scoreMatch = scoreText.match(/(\d+(?:[.,]\d+)?)\s*(?:pts|pontos|ponto)/i)
            if (!scoreMatch?.[1]) continue

            const score = parseFloat(scoreMatch[1].replace(',', '.'))
            if (isNaN(score) || score <= 0) continue

            const exists = collected.some(
              (r) => r.storeName.toLowerCase() === storeName.toLowerCase()
            )
            if (exists) continue

            // Try to get link and image from parent <a>
            let link: string | undefined
            let imageUrl: string | undefined
            const parentLink = container.closest('a[href]')
            if (parentLink) {
              const href = parentLink.getAttribute('href') || ''
              if (href.startsWith('/') || href.startsWith('http')) {
                link = href.startsWith('/') ? `https://www.esfera.com.vc${href}` : href
              }
              const img = parentLink.querySelector('img')
              if (img) {
                const src = img.getAttribute('src') || ''
                if (src && !src.startsWith('data:')) {
                  imageUrl = src.startsWith('/') ? `https://www.esfera.com.vc${src}` : src
                }
              }
            }

            collected.push({ storeName, score: Number.isInteger(score) ? score : score, link, imageUrl })
          } catch {
            continue
          }
        }
      }

      return collected
    })

    return results
  }

  /**
   * Fetch the rules HTML from a store's individual page on Esfera.
   * Extracts the "Regras gerais" section as raw HTML to preserve formatting.
   */
  private async fetchStoreRules(page: Page, url: string): Promise<string | undefined> {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })
      await new Promise((r) => setTimeout(r, 2000))

      const ruleHtml = await page.evaluate(() => {
        // Get the full content of the rules section including all paragraphs and lists
        const rulesContainer = document.querySelector('.accumulation-general-rules')
        if (rulesContainer) {
          return rulesContainer.innerHTML.trim()
        }

        // Fallback: look for the parent div that contains "Regras gerais"
        const allDivs = document.querySelectorAll('[class*="space-y-6"], [class*="text-grey-dark"]')
        for (const div of allDivs) {
          const heading = div.querySelector('h2')
          if (heading && (heading.textContent || '').includes('Regras')) {
            // Get everything after the heading
            const content = div.querySelector('[class*="general-rules"], [class*="ml-4"]')
            if (content) return content.innerHTML.trim()
          }
        }

        return undefined
      })

      return ruleHtml || undefined
    } catch {
      return undefined
    }
  }
}
