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

      console.log(`[LiveloScraper] ${results.length} lojas encontradas.`)

      // Only fetch categories on first run (when no stores have specific categories)
      const { db } = await import('../../config/database.js')
      const storesWithSpecificCat = await db.store.count({
        where: { AND: [{ category: { not: null } }, { category: { not: 'Outros' } }] },
      })
      if (storesWithSpecificCat === 0) {
        console.log('[LiveloScraper] Primeira execução — atribuindo categorias por palavras-chave...')
        await this.assignCategoriesByKeywords(results)
      } else {
        console.log(`[LiveloScraper] Categorias já mapeadas (${storesWithSpecificCat} lojas). Pulando.`)
      }

      console.log(`[LiveloScraper] Buscando detalhes...`)

      // Fetch details for each store that has a link
      // Report progress to crawlerService
      const { crawlerService } = await import('../../services/crawler.service.js')
      const { db: prismaDb } = await import('../../config/database.js')
      const liveloProgram = await prismaDb.loyaltyProgram.findFirst({ where: { name: 'Livelo' } })
      const totalWithLink = results.filter(r => r.link).length

      let detailsCount = 0
      for (const store of results) {
        if (!store.link) continue
        try {
          const details = await this.fetchStoreDetails(page, store.link)
          if (details.description) store.description = details.description
          if (details.rule) store.rule = details.rule
          if (details.deadline) store.deadline = details.deadline
          detailsCount++
          // Update progress for frontend
          if (liveloProgram) {
            crawlerService.progress.set(liveloProgram.id, { current: detailsCount, total: totalWithLink })
          }
          if (detailsCount % 20 === 0) {
            console.log(`[LiveloScraper] Detalhes: ${detailsCount}/${totalWithLink}`)
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
   * Assign categories by interacting with the Livelo category combobox.
   * Opens the dropdown, reads categories, clicks each one, and maps stores.
   * Falls back to keyword-based assignment for uncategorized stores.
   */
  private async assignCategoriesFromSite(page: Page, results: ScraperResult[]): Promise<void> {
    try {
      // Navigate back to the main page
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 60_000 })
      await new Promise((r) => setTimeout(r, 5000))

      // Click the category combobox to open it
      const combobox = await page.$('[data-testid="TextInput_SelectField"]')
      if (!combobox) {
        console.log('[LiveloScraper] Combobox de categorias não encontrado. Usando palavras-chave.')
        await this.assignCategoriesByKeywords(results)
        return
      }

      await combobox.click()
      await new Promise((r) => setTimeout(r, 1500))

      // Read all category options
      const categoryOptions = await page.evaluate(() => {
        const options: string[] = []
        const items = document.querySelectorAll('[role="option"], [data-testid*="option"], [class*="option"]')
        for (const item of items) {
          const text = (item.textContent || '').trim()
          if (text && text !== 'Ver todos' && text.length < 50) {
            options.push(text)
          }
        }
        return options
      })

      if (categoryOptions.length === 0) {
        console.log('[LiveloScraper] Nenhuma opção de categoria encontrada. Usando palavras-chave.')
        // Close dropdown
        await page.keyboard.press('Escape')
        await this.assignCategoriesByKeywords(results)
        return
      }

      console.log(`[LiveloScraper] ${categoryOptions.length} categorias encontradas: ${categoryOptions.join(', ')}`)

      // Close dropdown first
      await page.keyboard.press('Escape')
      await new Promise((r) => setTimeout(r, 500))

      // For each category, select it and see which stores appear
      for (const categoryName of categoryOptions) {
        try {
          // Click combobox
          await combobox.click()
          await new Promise((r) => setTimeout(r, 1000))

          // Click the category option
          await page.evaluate((catName) => {
            const items = document.querySelectorAll('[role="option"], [data-testid*="option"], [class*="option"]')
            for (const item of items) {
              if ((item.textContent || '').trim() === catName) {
                (item as HTMLElement).click()
                return
              }
            }
          }, categoryName)

          await new Promise((r) => setTimeout(r, 2000))

          // Scroll to load all stores in this category
          await this.scrollToBottom(page)

          // Get visible store names
          const visibleStores = await page.evaluate(() => {
            const names: string[] = []
            const imgs = document.querySelectorAll('[data-testid="img_PartnerCard_partnerImage"]')
            for (const img of imgs) {
              let name = (img.getAttribute('alt') || '').trim()
              if (name.toLowerCase().startsWith('logo ')) name = name.slice(5).trim()
              if (name) names.push(name)
            }
            return names
          })

          // Assign category to matching stores
          for (const store of results) {
            if (!store.category || store.category === 'Outros') {
              const match = visibleStores.some(
                (v) => v.toLowerCase() === store.storeName.toLowerCase()
              )
              if (match) {
                store.category = categoryName
              }
            }
          }

          console.log(`[LiveloScraper] Categoria "${categoryName}": ${visibleStores.length} lojas`)
        } catch {
          // Skip this category if it fails
        }
      }

      // Reset to "Ver todos"
      try {
        await combobox.click()
        await new Promise((r) => setTimeout(r, 1000))
        await page.evaluate(() => {
          const items = document.querySelectorAll('[role="option"], [data-testid*="option"], [class*="option"]')
          for (const item of items) {
            if ((item.textContent || '').trim() === 'Ver todos') {
              (item as HTMLElement).click()
              return
            }
          }
        })
      } catch {}

      // Assign "Outros" to remaining uncategorized stores
      let categorized = 0
      for (const store of results) {
        if (store.category && store.category !== 'Outros') categorized++
        if (!store.category) store.category = 'Outros'
      }

      console.log(`[LiveloScraper] Categorias do site: ${categorized} lojas categorizadas, ${results.length - categorized} como "Outros"`)

      // If very few were categorized from site, supplement with keywords
      if (categorized < 30) {
        console.log('[LiveloScraper] Poucas categorias do site. Complementando com palavras-chave...')
        await this.assignCategoriesByKeywords(results)
      }
    } catch (error) {
      console.warn('[LiveloScraper] Erro ao buscar categorias do site:', error instanceof Error ? error.message : error)
      console.log('[LiveloScraper] Usando categorias por palavras-chave como fallback.')
      await this.assignCategoriesByKeywords(results)
    }
  }

  /**
   * Assign categories based on store name keywords (reliable, no site interaction needed).
   */
  private async assignCategoriesByKeywords(results: ScraperResult[]): Promise<void> {
    const categoryMap: Record<string, string[]> = {
      'Moda': ['Adidas', 'Nike', 'Zara', 'C&A', 'Renner', 'Riachuelo', 'Shein', 'Dafiti', 'Netshoes', 'Centauro', 'Puma', 'Arezzo', 'Havaianas', 'Hering', 'Levi', 'Calvin Klein', 'Lacoste', 'Tommy', 'Reserva', 'Amaro', 'Shoulder', 'Farm', 'Animale', 'Osklen', 'Melissa', 'Vans', 'New Balance', 'Asics', 'Under Armour', 'Mizuno', 'Olympikus', 'Lupo', 'Track&Field', 'Youcom', 'Marisa', 'Posthaus', 'Privalia', 'Off Premium', 'Kanui', 'Tricae', 'Zattini', 'Vivara', 'Pandora', 'Swarovski', 'Ray-Ban', 'Oakley', 'Chilli Beans', 'Havan', 'Riachuelo', 'Lojas Renner', 'Centauro', 'World Tennis', 'Passarela', 'Dafiti', 'Restoque', 'Le Lis', 'Bo.Bô', 'John John', 'Ellus', 'Colcci', 'Forum', 'Morena Rosa', 'Lança Perfume'],
      'Eletrônicos': ['Samsung', 'Apple', 'Dell', 'Lenovo', 'HP', 'Multilaser', 'Positivo', 'LG', 'Sony', 'JBL', 'Bose', 'Philips', 'Motorola', 'Xiaomi', 'Huawei', 'Asus', 'Acer', 'Kabum', 'Pichau', 'Terabyte', 'Fast Shop', 'Girafa', 'Consul', 'Brastemp', 'Electrolux'],
      'Casa e Decoração': ['Tok&Stok', 'Etna', 'MadeiraMadeira', 'Leroy Merlin', 'Telhanorte', 'Camicado', 'Tramontina', 'Mondial', 'Britânia', 'Polishop', 'Mobly', 'Westwing', 'Shoptime', 'TendTudo', 'Zelo', 'Buddemeyer'],
      'Beleza': ['O Boticário', 'Boticário', 'Natura', 'Sephora', 'MAC', 'Avon', 'Eudora', 'Quem Disse Berenice', 'Beleza na Web', 'Época Cosméticos', 'The Body Shop', "L'Occitane", 'Dermage', 'Vult', 'Salon Line', 'Loccitane', 'Granado', 'Phytoervas', 'Bio Extratus'],
      'Supermercado': ['Carrefour', 'Extra', 'Pão de Açúcar', 'GPA', 'iFood', 'Rappi', 'Zé Delivery', 'James Delivery', 'Mambo'],
      'Viagens': ['Booking', 'Decolar', 'CVC', 'Hurb', 'Submarino Viagens', 'Latam', 'Gol', 'Azul', 'Airbnb', 'Hotels.com', 'Expedia', 'Rentcars', 'Localiza', 'Movida', 'Unidas', 'Smiles', 'Passagens Promo', '123milhas', 'MaxMilhas', 'Vai de Promo'],
      'Saúde e Bem-estar': ['Drogasil', 'Droga Raia', 'Panvel', 'Pague Menos', 'Ultrafarma', 'Drogaria São Paulo', 'Onofre', 'Netfarma', 'Growth', 'Integral Médica', 'Drogaria', 'Farmácia', 'Farma'],
      'Esporte e Lazer': ['Centauro', 'Netshoes', 'Decathlon', 'Bike', 'Surf', 'Fitness', 'Academia'],
      'Marketplace': ['Shopee', 'Amazon', 'Mercado Livre', 'Magazine Luiza', 'Magalu', 'Americanas', 'Submarino', 'Casas Bahia', 'Ponto', 'AliExpress', 'Wish', 'Shoptime'],
      'Alimentação': ['iFood', 'Rappi', 'Zé Delivery', 'Wine', 'Evino', 'Grand Cru', 'Nespresso', 'Dolce Gusto', 'Nestlé', 'Empório', 'Café'],
      'Pet': ['Petz', 'Cobasi', 'Petlove', 'DogHero', 'Pet'],
      'Infantil': ['Ri Happy', 'PBKids', 'Lego', 'Disney', 'Tricae', 'Baby', 'Kids', 'Infantil'],
      'Livros e Educação': ['Saraiva', 'Cultura', 'Estante Virtual', 'Udemy', 'Alura', 'Hotmart', 'Livro'],
      'Serviços': ['Uber', '99', 'Sem Parar', 'ConectCar', 'Vivo', 'Claro', 'Tim', 'Oi', 'NET', 'Sky', 'Porto Seguro', 'Seguro'],
      'Automotivo': ['Auto', 'Pneu', 'Carro', 'Moto', 'Combustível', 'Shell', 'Ipiranga'],
    }

    let categorized = 0
    for (const store of results) {
      const nameLower = store.storeName.toLowerCase()
      const matchedCategories: string[] = []

      for (const [category, keywords] of Object.entries(categoryMap)) {
        if (keywords.some((kw) => nameLower.includes(kw.toLowerCase()))) {
          matchedCategories.push(category)
        }
      }

      if (matchedCategories.length > 0) {
        store.category = matchedCategories.join(', ')
        categorized++
      } else {
        store.category = 'Outros'
      }
    }
    console.log(`[LiveloScraper] Categorias atribuídas: ${categorized} específicas, ${results.length - categorized} como "Outros"`)
  }

  /**
   * Assign categories to stores by clicking category filters on the page.
   */
  private async assignCategories(page: Page, results: ScraperResult[]): Promise<void> {
    try {
      // Go back to the main page
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30_000 })
      await new Promise((r) => setTimeout(r, 3000))

      // Find category filter buttons/tabs
      const categoryNames = await page.evaluate(() => {
        const cats: string[] = []
        // Look for filter elements (tabs, buttons, links with category names)
        const filterEls = document.querySelectorAll(
          '[role="tab"], [data-testid*="filter"], [data-testid*="category"], button, a'
        )
        for (const el of filterEls) {
          const text = (el.textContent || '').trim()
          // Category names are short, don't contain numbers, and aren't navigation items
          if (text.length >= 3 && text.length <= 30 &&
              !text.includes('pont') && !text.includes('Login') &&
              !text.includes('Criar') && !text.includes('Central') &&
              !text.includes('Trocar') && !text.includes('Juntar') &&
              text !== 'Todos' && text !== 'Ver mais') {
            // Check if it looks like a category (capitalized, no special chars)
            if (/^[A-ZÀ-Ú]/.test(text) && !cats.includes(text)) {
              cats.push(text)
            }
          }
        }
        return cats
      })

      // Filter to likely categories (from the page context)
      const likelyCategories = categoryNames.filter(name =>
        ['Moda', 'Eletrônicos', 'Viagens', 'Beleza', 'Casa', 'Esporte', 'Saúde',
         'Alimentação', 'Entretenimento', 'Serviços', 'Educação', 'Tecnologia',
         'Ofertas', 'Clube', 'Novidades', 'Shopping', 'Supermercado', 'Pet',
         'Infantil', 'Automotivo', 'Livros', 'Games'].some(cat =>
          name.toLowerCase().includes(cat.toLowerCase())
        )
      )

      if (likelyCategories.length === 0) {
        console.log('[LiveloScraper] Nenhuma categoria identificada nos filtros.')
        return
      }

      console.log(`[LiveloScraper] Categorias encontradas: ${likelyCategories.join(', ')}`)

      // For each category, click the filter and see which stores appear
      for (const categoryName of likelyCategories) {
        try {
          // Click the category filter
          await page.evaluate((catName) => {
            const elements = document.querySelectorAll('[role="tab"], button, a')
            for (const el of elements) {
              if ((el.textContent || '').trim() === catName) {
                (el as HTMLElement).click()
                return
              }
            }
          }, categoryName)

          await new Promise((r) => setTimeout(r, 2000))

          // Get store names visible after filtering
          const visibleStores = await page.evaluate(() => {
            const names: string[] = []
            const imgs = document.querySelectorAll('[data-testid="img_PartnerCard_partnerImage"]')
            for (const img of imgs) {
              let name = (img.getAttribute('alt') || '').trim()
              if (name.toLowerCase().startsWith('logo ')) name = name.slice(5).trim()
              if (name) names.push(name.toLowerCase())
            }
            return names
          })

          // Assign category to matching stores
          for (const store of results) {
            if (visibleStores.includes(store.storeName.toLowerCase())) {
              if (!store.category) {
                store.category = categoryName
              }
            }
          }
        } catch {
          // Skip this category if clicking fails
        }
      }

      // Click "Todos" to reset
      try {
        await page.evaluate(() => {
          const elements = document.querySelectorAll('[role="tab"], button, a')
          for (const el of elements) {
            if ((el.textContent || '').trim() === 'Todos') {
              (el as HTMLElement).click()
              return
            }
          }
        })
      } catch {}
    } catch (error) {
      console.warn('[LiveloScraper] Erro ao buscar categorias:', error instanceof Error ? error.message : error)
    }
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
