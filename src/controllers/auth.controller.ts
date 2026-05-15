import type { Request, Response, NextFunction } from 'express'
import {
  loginSchema,
  initiateActivationSchema,
  confirmActivationSchema,
  resendTokenSchema,
} from '../validators/auth.validator.js'
import { AuthService } from '../services/auth.service.js'
import { ValidationError } from '../middleware/errorHandler.js'

/**
 * Extrai a primeira mensagem de erro legível dos issues do Zod.
 */
function getFirstZodError(issues: unknown[]): string {
  if (!Array.isArray(issues) || issues.length === 0) return 'Dados inválidos'
  const first = issues[0] as { message?: string; path?: string[] }
  return first?.message || 'Dados inválidos'
}

export const AuthController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        const msg = getFirstZodError(parsed.error.issues)
        throw new ValidationError(msg)
      }

      const { email, password } = parsed.data
      const result = await AuthService.login(email, password)

      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },

  async initiateActivation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = initiateActivationSchema.safeParse(req.body)
      if (!parsed.success) {
        const msg = getFirstZodError(parsed.error.issues)
        throw new ValidationError(msg)
      }

      const { email } = parsed.data
      await AuthService.initiateActivation(email)

      res.status(200).json({ message: 'Token de ativação enviado para o e-mail informado' })
    } catch (error) {
      next(error)
    }
  },

  async confirmActivation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = confirmActivationSchema.safeParse(req.body)
      if (!parsed.success) {
        const msg = getFirstZodError(parsed.error.issues)
        throw new ValidationError(msg)
      }

      const { email, token, password, name, phone } = parsed.data
      const result = await AuthService.activateAccount(email, token, password, { name, phone })

      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  },

  async resendToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = resendTokenSchema.safeParse(req.body)
      if (!parsed.success) {
        const msg = getFirstZodError(parsed.error.issues)
        throw new ValidationError(msg)
      }

      const { email } = parsed.data
      await AuthService.resendToken(email)

      res.status(200).json({ message: 'Novo token de ativação enviado' })
    } catch (error) {
      next(error)
    }
  },

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ message: 'Logout realizado com sucesso' })
    } catch (error) {
      next(error)
    }
  },
}
