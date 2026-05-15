import type { Request, Response, NextFunction } from 'express'
import { storeFiltersSchema } from '../validators/stores.validator.js'
import { storeService } from '../services/store.service.js'
import { ValidationError } from '../middleware/errorHandler.js'

function getFirstZodError(issues: unknown[]): string {
  if (!Array.isArray(issues) || issues.length === 0) return 'Filtro inválido'
  const first = issues[0] as { message?: string }
  return first?.message || 'Filtro inválido'
}

export const StoresController = {
  async listStores(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = storeFiltersSchema.safeParse(req.query)
      if (!parsed.success) {
        throw new ValidationError(getFirstZodError(parsed.error.issues))
      }

      const result = await storeService.listStores(parsed.data)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },

  async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await storeService.listCategories()
      res.status(200).json(categories)
    } catch (error) {
      next(error)
    }
  },

  async listPrograms(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { db } = await import('../config/database.js')
      const programs = await db.loyaltyProgram.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
      res.status(200).json(programs)
    } catch (error) {
      next(error)
    }
  },

  async getStoreDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const store = await storeService.getStoreDetails(id)
      if (!store) {
        res.status(404).json({ error: 'Loja não encontrada' })
        return
      }
      res.status(200).json(store)
    } catch (error) {
      next(error)
    }
  },
}
