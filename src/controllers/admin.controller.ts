import type { Request, Response, NextFunction } from 'express'
import { createUserSchema, createProgramSchema } from '../validators/admin.validator.js'
import { UserService } from '../services/user.service.js'
import { AuthService } from '../services/auth.service.js'
import { programService } from '../services/program.service.js'
import { runCrawler } from '../crawler/index.js'
import { db } from '../config/database.js'
import { ValidationError } from '../middleware/errorHandler.js'
import { getCurrentSchedule, updateSchedule } from '../config/scheduler.js'

function getFirstZodError(issues: unknown[]): string {
  if (!Array.isArray(issues) || issues.length === 0) return 'Dados inválidos'
  const first = issues[0] as { message?: string }
  return first?.message || 'Dados inválidos'
}

export const AdminController = {
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createUserSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError(getFirstZodError(parsed.error.issues))
      }

      const { email, name, phone, sendActivationNow } = parsed.data

      const user = await UserService.createUser({ email, name, phone, sendActivationNow })

      let activationStatus: 'sent' | 'pending' = 'pending'

      if (sendActivationNow) {
        try {
          await AuthService.initiateActivation(email)
          activationStatus = 'sent'
        } catch {
          // If activation email fails, user is still created but status remains pending
          activationStatus = 'pending'
        }
      }

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          activationStatus,
        },
      })
    } catch (error) {
      next(error)
    }
  },

  async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await db.user.findMany({
        orderBy: { createdAt: 'desc' },
      })

      res.json(users)
    } catch (error) {
      next(error)
    }
  },

  async toggleUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params
      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' })
        return
      }

      const updated = await db.user.update({
        where: { id: userId },
        data: { isActive: !user.isActive },
      })

      res.json(updated)
    } catch (error) {
      next(error)
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params
      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' })
        return
      }

      if (user.isActive) {
        res.status(400).json({ error: 'Não é possível excluir um usuário ativo. Desative-o primeiro.' })
        return
      }

      await db.user.delete({ where: { id: userId } })
      res.json({ message: 'Usuário excluído com sucesso' })
    } catch (error) {
      next(error)
    }
  },

  async listPrograms(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programs = await programService.listPrograms()
      res.json(programs)
    } catch (error) {
      next(error)
    }
  },

  async createProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createProgramSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError(getFirstZodError(parsed.error.issues))
      }

      const program = await programService.createProgram(parsed.data)
      res.status(201).json(program)
    } catch (error) {
      next(error)
    }
  },

  async updateProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { programId } = req.params
      const { url, isActive } = req.body

      const updateData: Record<string, unknown> = {}
      if (url !== undefined) updateData.url = url
      if (isActive !== undefined) updateData.isActive = isActive

      const program = await db.loyaltyProgram.update({
        where: { id: programId },
        data: updateData,
      })

      res.json(program)
    } catch (error) {
      next(error)
    }
  },

  async runCrawler(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await runCrawler()
      res.json({ results })
    } catch (error) {
      next(error)
    }
  },

  async runCrawlerForProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { programId } = req.params
      if (!programId) {
        throw new ValidationError('ID do programa é obrigatório')
      }

      const { crawlerService } = await import('../services/crawler.service.js')
      const result = await crawlerService.runForProgram(programId)
      res.json({ results: [result] })
    } catch (error) {
      next(error)
    }
  },

  async getCrawlerSchedule(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = await getCurrentSchedule()
      res.json({ schedule })
    } catch (error) {
      next(error)
    }
  },

  async updateCrawlerSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { schedule } = req.body
      if (!schedule || typeof schedule !== 'string') {
        throw new ValidationError('Expressão cron é obrigatória')
      }

      await updateSchedule(schedule)
      res.json({ message: 'Horário atualizado com sucesso', schedule })
    } catch (error) {
      next(error)
    }
  },

  async getCrawlerHistory(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await db.crawlLog.findMany({
        orderBy: { completedAt: 'desc' },
        take: 100,
      })
      res.json(logs)
    } catch (error) {
      next(error)
    }
  },
}
