import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/token.js'

export interface AuthUser {
  userId: string
  email: string
  role: 'admin' | 'client'
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/**
 * Middleware that extracts and verifies JWT from the Authorization header.
 * Attaches decoded user info to req.user.
 * JWT tokens include a 30-minute expiration set at generation time.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const decoded = verifyToken(token) as AuthUser
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

/**
 * Middleware factory that checks if the authenticated user has the required role.
 * Must be used after the `authenticate` middleware.
 */
export function requireRole(...roles: Array<'admin' | 'client'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Token não fornecido' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso não autorizado' })
      return
    }

    next()
  }
}
