import { db } from '../config/database.js'
import { ConflictError } from '../middleware/errorHandler.js'

export interface CreateProgramInput {
  name: string
  url: string
}

export const programService = {
  /**
   * Lists all active loyalty programs.
   */
  async listPrograms() {
    return db.loyaltyProgram.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  /**
   * Creates a new loyalty program after validating name uniqueness (case-insensitive).
   */
  async createProgram(data: CreateProgramInput) {
    const existing = await programService.findByName(data.name)

    if (existing) {
      throw new ConflictError('Programa de fidelidade com este nome já existe')
    }

    return db.loyaltyProgram.create({
      data: {
        name: data.name,
        url: data.url,
      },
    })
  },

  /**
   * Finds a loyalty program by name (case-insensitive).
   * Returns the program or null if not found.
   */
  async findByName(name: string) {
    const programs = await db.loyaltyProgram.findMany()
    const match = programs.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    )
    return match ?? null
  },
}
