import { describe, it, expect } from 'vitest'
import { prisma, db } from '../../../src/config/database.js'

describe('database config', () => {
  it('should export a PrismaClient instance as prisma', () => {
    expect(prisma).toBeDefined()
    expect(typeof prisma.$connect).toBe('function')
    expect(typeof prisma.$disconnect).toBe('function')
  })

  it('should export db as an alias for prisma', () => {
    expect(db).toBe(prisma)
  })

  it('should return the same instance on multiple imports (singleton)', async () => {
    const { prisma: prisma2 } = await import('../../../src/config/database.js')
    expect(prisma2).toBe(prisma)
  })
})
