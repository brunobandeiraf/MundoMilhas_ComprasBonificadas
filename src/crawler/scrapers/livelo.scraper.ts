/// <reference lib="dom" />

import puppeteer, { type Browser, type Page } from 'puppeteer'
import type { BaseScraper, ScraperResult } from './base.scraper.js'

const LIVELO_URL = 'https://www.livelo.com.br/juntar-pontos/todos-os-parceiros'
const TIMEOUT_MS = 120_000 // 120 seconds

/**
 * Scraper for the Livelo loyalty program.
 *
 * HTML structure (real):
 * - Store name: <img alt="Logo Shopee" data-testid="img_PartnerCard_partnerImage" ...>
 *   → Extract alt, remove "Logo " prefix → "Shopee"
 * - Score: <div data-testid="Text_Typography">Até <strong>2 pontos</strong> por R$ 1</div>
 *   → Extract number before "pontos" → score = 2 (meaning 2:1)
 */
export class LiveloScraper implements BaseScraper {
  programName = 'Livelo'

  private url: string
  private timeout: number

  constructor(url: string = LIVELO_URL, timeout: number = TIMEOUT_MS) {
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

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      // Hide webdriver flag
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })
      page.setDefaultTimeout(this.timeout)
      page.setDefaultNavigationTimeout(this.timeout)

      await page.setViewport({ width: 1280, height: 800 })

      console.log(`[LiveloScraper] Acessando ${this.url}...`)

      await page.goto(this.url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      })

      console.log('[LiveloScraper] Página carregada, aguardando cards...')

      // Wait for the partner cards to render
      await this.waitForPartnerCards(page)

      // Scroll to load all lazy-loaded content
      await this.scrollToBottom(page)

      console.log('[LiveloScraper] Extraindo lojas...')

      // Extract all stores from the page
      const results = await this.extractStores(page)

      console.log(`[LiveloScraper] ${results.length} lojas encontradas. Buscando detalhes...`)

      // Fetch details for each store that has a link
      let detailsCount = 0
      for (const store of results) {
        if (!store.link) continue
        try {
          const details = await this.fetchStoreDetails(page, store.link)
          if (details.description) store.description = details.description
          if (details.rule) store.rule = details.rule
          if (details.deadline) store.deadline = details.deadline
          detailsCount++
          if (detailsCount % 20 === 0) {
            console.log(`[LiveloScraper] Detalhes: ${detailsCount}/${results.filter(r => r.link).length}`)
          }
        } catch {
          // Skip if details fetch fails for a store
        }
      }

      console.log(`[LiveloScraper] Detalhes coletados para ${detailsCount} lojas.`)

      return results
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          throw new Error(
            `Timeout após ${this.timeout / 1000}s ao acessar ${this.url}`
          )
        }
        if (error.message.includes('net::') || error.message.includes('ECONNREFUSED')) {
          throw new Error(
            `Erro de conexão ao acessar ${this.url}`
          )
        }
        throw new Error(`Erro durante scraping: ${error.message}`)
      }
      throw new Error(`Erro desconhecido durante scraping`)
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }

  /**
   * Wait for partner card images to appear (the key indicator that content loaded).
   */
  private async waitForPartnerCards(page: Page): Promise<void> {
    try {
      // Wait for the specific data-testid used by Livelo
      await page.waitForSelector('[data-testid="img_PartnerCard_partnerImage"]', {
        timeout: 60_000,
      })
      return
    } catch {
      // Fallback: try generic selectors
    }

    try {
      await page.waitForSelector('img[alt^="Logo"]', { timeout: 30_000 })
      return
    } catch {
      // Fallback
    }

    // Last resort: wait for network to settle
    await page.waitForNetworkIdle({ timeout: this.timeout })
  }

  /**
   * Scroll to the bottom of the page to trigger lazy loading of all cards.
   */
  private async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0
        const distance = 500
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance
          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 200)

        // Safety timeout
        setTimeout(() => {
          clearInterval(timer)
          resolve()
        }, 15000)
      })
    })

    // Wait a bit for any final lazy loads
    await new Promise((r) => setTimeout(r, 2000))
  }

  /**
   * Extract store names, scores, images and categories from the page.
   *
   * Real HTML:
   * - img[data-testid="img_PartnerCard_partnerImage"] alt="Logo Shopee" src="..."
   * - Text: "Até 2 pontos por R$ 1"
   * - Category from page sections or card tags
   */
  private async extractStores(page: Page): Promise<ScraperResult[]> {
    // First, try to extract available categories from the page filters/tabs
    const pageCategories = await page.evaluate(() => {
      const cats: string[] = []
      // Look for filter buttons/tabs that represent categories
      const filterEls = document.querySelectorAll(
        '[data-testid*="filter"], [data-testid*="category"], [class*="filter"] button, [class*="category"] button, [class*="tab"] button, [role="tab"]'
      )
      for (const el of filterEls) {
        const text = (el.textContent || '').trim()
        if (text && text.length < 40 && !text.includes('pont') && text !== 'Todos') {
          cats.push(text)
        }
      }
      return cats
    })

    console.log(`[LiveloScraper] Categorias encontradas na página: ${pageCategories.length > 0 ? pageCategories.join(', ') : 'nenhuma'}`)

    const results = await page.evaluate(() => {
      const collected: Array<{ storeName: string; score: number; imageUrl?: string; category?: string; link?: string }> = []

      // Find all images with the specific data-testid
      const partnerImages = document.querySelectorAll(
        '[data-testid="img_PartnerCard_partnerImage"]'
      )

      for (const img of partnerImages) {
        try {
          const alt = (img.getAttribute('alt') || '').trim()
          if (!alt) continue

          // Remove "Logo " prefix
          let storeName = alt
          if (storeName.toLowerCase().startsWith('logo ')) {
            storeName = storeName.slice(5).trim()
          }
          if (!storeName) continue

          // Get image URL from src or srcset
          let imageUrl = img.getAttribute('src') || ''
          if (!imageUrl || imageUrl.startsWith('data:')) {
            const srcset = img.getAttribute('srcset') || ''
            const firstSrc = srcset.split(',')[0]?.trim().split(' ')[0]
            if (firstSrc) imageUrl = firstSrc
          }

          // Find the parent card container
          let card: Element | null = img.parentElement
          for (let i = 0; i < 10 && card; i++) {
            const text = card.textContent || ''
            if (text.includes('pont')) break
            card = card.parentElement
          }

          if (!card) continue

          // Extract score
          const cardText = card.textContent || ''
          const scoreMatch =
            cardText.match(/[Aa]t[ée]\s+(\d+(?:[.,]\d+)?)\s*pont/i) ||
            cardText.match(/(\d+(?:[.,]\d+)?)\s*pont/i)

          if (!scoreMatch?.[1]) continue

          const scoreStr = scoreMatch[1].replace(',', '.')
          const score = parseFloat(scoreStr)
          if (isNaN(score) || score <= 0) continue

          const finalScore = Number.isInteger(score) ? score : score

          // Try to extract category from card or parent section
          let category: string | undefined
          // Look for category tags/labels in the card
          const categoryEl = card.querySelector('[class*="category"], [class*="tag"], [class*="segment"]')
          if (categoryEl) {
            category = (categoryEl.textContent || '').trim()
          }
          // Fallback: look at parent section heading
          if (!category) {
            let section: Element | null = card.parentElement
            for (let i = 0; i < 5 && section; i++) {
              const heading = section.querySelector('h2, h3, [class*="title"]')
              if (heading) {
                const headingText = (heading.textContent || '').trim()
                if (headingText && !headingText.includes('pont') && headingText.length < 50) {
                  category = headingText
                  break
                }
              }
              section = section.parentElement
            }
          }

          // Extract link from the card (look for <a> wrapping the card)
          let link: string | undefined
          const linkEl = card.querySelector('a[href]') || card.closest('a[href]')
          if (linkEl) {
            const href = linkEl.getAttribute('href') || ''
            if (href.startsWith('/') || href.startsWith('http')) {
              link = href.startsWith('/') ? `https://www.livelo.com.br${href}` : href
            }
          }

          // Avoid duplicates
          const exists = collected.some(
            (r) => r.storeName.toLowerCase() === storeName.toLowerCase()
          )
          if (exists) continue

          collected.push({
            storeName,
            score: finalScore,
            imageUrl: imageUrl || undefined,
            category: category || undefined,
            link,
          })
        } catch {
          continue
        }
      }

      // Fallback strategy
      if (collected.length === 0) {
        const allLogos = document.querySelectorAll('img[alt^="Logo"]')

        for (const img of allLogos) {
          try {
            const alt = (img.getAttribute('alt') || '').trim()
            if (!alt) continue

            let storeName = alt
            if (storeName.toLowerCase().startsWith('logo ')) {
              storeName = storeName.slice(5).trim()
            }
            if (!storeName) continue

            const imageUrl = img.getAttribute('src') || ''

            let card: Element | null = img.parentElement
            for (let i = 0; i < 15 && card; i++) {
              const text = card.textContent || ''
              if (text.includes('pont')) break
              card = card.parentElement
            }

            if (!card) continue

            const cardText = card.textContent || ''
            const scoreMatch =
              cardText.match(/[Aa]t[ée]\s+(\d+(?:[.,]\d+)?)\s*pont/i) ||
              cardText.match(/(\d+(?:[.,]\d+)?)\s*pont/i)

            if (!scoreMatch?.[1]) continue

            const scoreStr = scoreMatch[1].replace(',', '.')
            const score = parseFloat(scoreStr)
            if (isNaN(score) || score <= 0) continue

            const finalScore = Number.isInteger(score) ? score : score

            const exists = collected.some(
              (r) => r.storeName.toLowerCase() === storeName.toLowerCase()
            )
            if (exists) continue

            // Extract link
            let link: string | undefined
            const linkEl = card.querySelector('a[href]') || card.closest('a[href]')
            if (linkEl) {
              const href = linkEl.getAttribute('href') || ''
              if (href.startsWith('/') || href.startsWith('http')) {
                link = href.startsWith('/') ? `https://www.livelo.com.br${href}` : href
              }
            }

            collected.push({
              storeName,
              score: finalScore,
              imageUrl: imageUrl || undefined,
              link,
            })
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
   * Fetch details (description, rule, deadline) from a store's individual page on Livelo.
   *
   * HTML structure:
   * - Description: <div data-testid="Text_Typography" class="css-bpy6zc"><div><p>Ganhe 2 pontos...</p></div></div>
   * - Rule: <div data-testid="Text_ImportantInformation_itemTitle_0">Regra</div> followed by text
   * - Deadline: <div data-testid="Text_ImportantInformation_itemTitle_1">Prazo</div> followed by text
   */
  private async fetchStoreDetails(
    page: Page,
    url: string
  ): Promise<{ description?: string; rule?: string; deadline?: string }> {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      })

      // Wait for content to render
      await new Promise((r) => setTimeout(r, 1500))

      const details = await page.evaluate(() => {
        let description: string | undefined
        let rule: string | undefined
        let deadline: string | undefined

        // === DESCRIPTION ===
        // Located in: <div data-testid="Text_Typography" class="css-bpy6zc"><div><p>...</p></div></div>
        // It's the first Text_Typography that contains promotional text (pontos, Ganhe, gasto)
        const typographyEls = document.querySelectorAll('[data-testid="Text_Typography"]')
        for (const el of typographyEls) {
          const p = el.querySelector('p')
          const text = (p?.textContent || el.textContent || '').trim()
          if (text.length > 20 && text.length < 600 &&
              (text.includes('pont') || text.includes('Ganhe') || text.includes('gasto') || text.includes('compra'))) {
            description = text
            break
          }
        }

        // === RULE ===
        // Located after: <div data-testid="Text_ImportantInformation_itemTitle_0">Regra</div>
        const ruleTitle = document.querySelector('[data-testid="Text_ImportantInformation_itemTitle_0"]')
        if (ruleTitle) {
          // The content is in the next sibling (a div with data-testid="Text_Typography")
          const parent = ruleTitle.parentElement
          if (parent) {
            const ruleContent = parent.querySelector('[data-testid="Text_Typography"]')
            if (ruleContent) {
              const p = ruleContent.querySelector('p')
              rule = (p?.textContent || ruleContent.textContent || '').trim()
            }
          }
        }

        // === DEADLINE (PRAZO) ===
        // Located after: <div data-testid="Text_ImportantInformation_itemTitle_1">Prazo</div>
        const deadlineTitle = document.querySelector('[data-testid="Text_ImportantInformation_itemTitle_1"]')
        if (deadlineTitle) {
          const parent = deadlineTitle.parentElement
          if (parent) {
            const deadlineContent = parent.querySelector('[data-testid="Text_Typography"]')
            if (deadlineContent) {
              const p = deadlineContent.querySelector('p')
              deadline = (p?.textContent || deadlineContent.textContent || '').trim()
            }
          }
        }

        // Fallback for rule/deadline if data-testid not found
        if (!rule || !deadline) {
          const allDivs = document.querySelectorAll('[data-testid^="Text_ImportantInformation_itemTitle"]')
          for (const titleEl of allDivs) {
            const titleText = (titleEl.textContent || '').trim().toLowerCase()
            const parent = titleEl.parentElement
            if (!parent) continue

            const contentEl = parent.querySelector('[data-testid="Text_Typography"]')
            const content = contentEl
              ? (contentEl.querySelector('p')?.textContent || contentEl.textContent || '').trim()
              : ''

            if (!content) continue

            if (titleText.includes('regra') && !rule) {
              rule = content
            } else if (titleText.includes('prazo') && !deadline) {
              deadline = content
            }
          }
        }

        return { description, rule, deadline }
      })

      return details
    } catch {
      return {}
    }
  }
}
