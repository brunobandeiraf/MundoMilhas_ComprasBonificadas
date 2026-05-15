import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
} from '../../../src/middleware/errorHandler.js'

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const mockReq = {} as Request
const mockNext = vi.fn() as NextFunction

describe('Custom Error Classes', () => {
  it('ValidationError has status 400', () => {
    const err = new ValidationError('Invalid input')
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Invalid input')
    expect(err.name).toBe('ValidationError')
  })

  it('ValidationError supports details', () => {
    const details = { field: 'email', reason: 'invalid format' }
    const err = new ValidationError('Invalid input', details)
    expect(err.details).toEqual(details)
  })

  it('AuthenticationError has status 401', () => {
    const err = new AuthenticationError()
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Credenciais inválidas')
  })

  it('AuthenticationError accepts custom message', () => {
    const err = new AuthenticationError('Token expirado')
    expect(err.message).toBe('Token expirado')
  })

  it('ForbiddenError has status 403', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Acesso negado')
  })

  it('NotFoundError has status 404', () => {
    const err = new NotFoundError()
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Recurso não encontrado')
  })

  it('ConflictError has status 409', () => {
    const err = new ConflictError()
    expect(err.statusCode).toBe(409)
    expect(err.message).toBe('Conflito com recurso existente')
  })

  it('RateLimitError has status 429', () => {
    const err = new RateLimitError()
    expect(err.statusCode).toBe(429)
    expect(err.message).toBe('Muitas requisições. Tente novamente mais tarde.')
  })

  it('all errors extend AppError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(AppError)
    expect(new AuthenticationError()).toBeInstanceOf(AppError)
    expect(new ForbiddenError()).toBeInstanceOf(AppError)
    expect(new NotFoundError()).toBeInstanceOf(AppError)
    expect(new ConflictError()).toBeInstanceOf(AppError)
    expect(new RateLimitError()).toBeInstanceOf(AppError)
  })

  it('all errors extend Error', () => {
    expect(new ValidationError('x')).toBeInstanceOf(Error)
    expect(new AuthenticationError()).toBeInstanceOf(Error)
    expect(new ForbiddenError()).toBeInstanceOf(Error)
    expect(new NotFoundError()).toBeInstanceOf(Error)
    expect(new ConflictError()).toBeInstanceOf(Error)
    expect(new RateLimitError()).toBeInstanceOf(Error)
  })
})

describe('errorHandler middleware', () => {
  it('returns correct status and message for ValidationError', () => {
    const res = createMockRes()
    const err = new ValidationError('Campo obrigatório')

    errorHandler(err, mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Campo obrigatório' })
  })

  it('includes details when present in AppError', () => {
    const res = createMockRes()
    const details = { fields: ['email', 'name'] }
    const err = new ValidationError('Dados inválidos', details)

    errorHandler(err, mockReq, res, mockNext)

    expect(res.json).toHaveBeenCalledWith({
      error: 'Dados inválidos',
      details: { fields: ['email', 'name'] },
    })
  })

  it('returns 401 for AuthenticationError', () => {
    const res = createMockRes()
    errorHandler(new AuthenticationError(), mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciais inválidas' })
  })

  it('returns 403 for ForbiddenError', () => {
    const res = createMockRes()
    errorHandler(new ForbiddenError(), mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' })
  })

  it('returns 404 for NotFoundError', () => {
    const res = createMockRes()
    errorHandler(new NotFoundError(), mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Recurso não encontrado' })
  })

  it('returns 409 for ConflictError', () => {
    const res = createMockRes()
    errorHandler(new ConflictError('E-mail já cadastrado'), mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'E-mail já cadastrado' })
  })

  it('returns 429 for RateLimitError', () => {
    const res = createMockRes()
    errorHandler(new RateLimitError(), mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({ error: 'Muitas requisições. Tente novamente mais tarde.' })
  })

  it('returns 500 for unknown errors', () => {
    const res = createMockRes()
    const err = new Error('Something unexpected')

    errorHandler(err, mockReq, res, mockNext)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' })
  })

  it('does not include details for unknown errors', () => {
    const res = createMockRes()
    const err = new Error('DB connection failed')

    errorHandler(err, mockReq, res, mockNext)

    const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(jsonCall).not.toHaveProperty('details')
    expect(jsonCall).not.toHaveProperty('stack')
  })
})
