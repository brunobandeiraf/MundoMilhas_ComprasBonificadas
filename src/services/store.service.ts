import { db } from '../config/database.js'
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js'
import { ValidationError } from '../middleware/errorHandler.js'

export interface StoreFilters {
  search?: string
  category?: string
  minScore?: number
  maxScore?: number
  page?: number
  limit?: number
}

export interface StoreWithScore {
  id: string
  name: string
  imageUrl: string | null
  category: string | null
  description: string | null
  link: string | null
  bestScore: number
  programName: string
  scores: Array<{ programName: string; score: number }>
}

export const storeService = {
  async listStores(filters: StoreFilters) {
    const { skip, take, page, limit } = parsePagination({
      page: filters.page,
      limit: filters.limit,
    })

    if (
      filters.minScore !== undefined &&
      filters.maxScore !== undefined &&
      filters.minScore > filters.maxScore
    ) {
      throw new ValidationError('Faixa de pontuação inválida: valor mínimo maior que valor máximo')
    }

    // Fetch ALL stores with scores
    const stores = await db.store.findMany({
      include: {
        scores: {
          include: {
            program: true,
          },
        },
      },
    })

    // Process stores
    const processedStores: StoreWithScore[] = []
    const searchLower = filters.search?.toLowerCase()

    for (const store of stores) {
      if (store.scores.length === 0) continue

      // Name filter
      if (searchLower && !store.name.toLowerCase().includes(searchLower)) continue

      // Category filter
      if (filters.category && store.category !== filters.category) continue

      // Find the best score across all programs
      let bestScore = 0
      let programName = ''

      for (const bonusScore of store.scores) {
        if (bonusScore.score > bestScore) {
          bestScore = bonusScore.score
          programName = bonusScore.program.name
        }
      }

      // Score range filter
      if (filters.minScore !== undefined && bestScore < filters.minScore) continue
      if (filters.maxScore !== undefined && bestScore > filters.maxScore) continue

      processedStores.push({
        id: store.id,
        name: store.name,
        imageUrl: store.imageUrl,
        category: store.category,
        description: store.description,
        link: store.link,
        bestScore,
        programName,
        scores: store.scores.map((s) => ({
          programName: s.program.name,
          score: s.score,
        })),
      })
    }

    // Sort by bestScore descending
    processedStores.sort((a, b) => b.bestScore - a.bestScore)

    // Pagination
    const total = processedStores.length
    const paginatedData = processedStores.slice(skip, skip + take)

    return formatPaginatedResponse(paginatedData, total, page, limit)
  },

  async listCategories(): Promise<string[]> {
    const stores = await db.store.findMany({
      where: { category: { not: null } },
      select: { category: true },
    })
    const categories = [...new Set(stores.map((s) => s.category!).filter(Boolean))]
    return categories.sort()
  },

  async getStoreDetails(storeId: string) {
    const store = await db.store.findUnique({
      where: { id: storeId },
      include: {
        scores: {
          include: { program: true },
        },
        history: {
          orderBy: { date: 'asc' },
          include: { program: true },
        },
      },
    })

    if (!store) return null

    return {
      id: store.id,
      name: store.name,
      imageUrl: store.imageUrl,
      category: store.category,
      description: store.description,
      link: store.link,
      scores: store.scores.map((s) => ({
        programName: s.program.name,
        score: s.score,
        description: s.description,
        rule: s.rule,
        deadline: s.deadline,
        link: s.link,
      })),
      history: store.history.map((h) => ({
        date: h.date,
        score: h.score,
        programName: h.program.name,
      })),
    }
  },

  async upsertStore(name: string) {
    const stores = await db.store.findMany()
    const existing = stores.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    )

    if (existing) return existing

    return db.store.create({ data: { name } })
  },

  async updateScore(storeId: string, programId: string, score: number) {
    await db.bonusScore.upsert({
      where: {
        storeId_programId: { storeId, programId },
      },
      update: { score },
      create: { storeId, programId, score },
    })
  },

  async removeScoresNotInList(programId: string, storeNames: string[]) {
    const normalizedNames = storeNames.map((name) => name.toLowerCase())

    const scoresForProgram = await db.bonusScore.findMany({
      where: { programId },
      include: { store: true },
    })

    const scoreIdsToDelete = scoresForProgram
      .filter((s) => !normalizedNames.includes(s.store.name.toLowerCase()))
      .map((s) => s.id)

    if (scoreIdsToDelete.length > 0) {
      await db.bonusScore.deleteMany({
        where: { id: { in: scoreIdsToDelete } },
      })
    }
  },
}
