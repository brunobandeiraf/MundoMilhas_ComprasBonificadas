import type { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: object
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: object) {
    super(400, message, details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Credenciais inválidas') {
    super(401, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(403, message)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(404, message)
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflito com recurso existente') {
    super(409, message)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Muitas requisições. Tente novamente mais tarde.') {
    super(429, message)
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: { error: string; details?: object } = { error: err.message }
    if (err.details) {
      response.details = err.details
    }
    res.status(err.statusCode).json(response)
    return
  }

  // Unexpected errors
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Erro interno do servidor' })
}
