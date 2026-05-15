import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('../../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    DATABASE_URL: 'file:./test.db',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 587,
    SMTP_USER: 'test',
    SMTP_PASS: 'test',
    CRON_SCHEDULE: '0 10,17 * * *',
  },
}))

import { authenticate, requireRole } from '../../../src/middleware/auth.js'
import { generateToken } from '../../../src/utils/token.js'

function createMockRequest(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  }
}

function createMockResponse(): Partial<Response> & { statusCode?: number; body?: unknown } {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {}
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code
    return res
  }) as unknown as Response['status']
  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.body = data
    return res
  }) as unknown as Response['json']
  return res
}

describe('authenticate middleware', () => {
  let next: NextFunction

  beforeEach(() => {
    next = vi.fn()
  })

  it('returns 401 when no Authorization header is present', () => {
    const req = createMockRequest() as Request
    const res = createMockResponse() as Response

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token não fornecido' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const req = createMockRequest('Basic abc123') as Request
    const res = createMockResponse() as Response

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token não fornecido' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is invalid', () => {
    const req = createMockRequest('Bearer invalid.token.here') as Request
    const res = createMockResponse() as Response

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido ou expirado' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is expired', () => {
    const token = generateToken({ userId: '123', email: 'test@test.com', role: 'client' }, '0s')
    const req = createMockRequest(`Bearer ${token}`) as Request
    const res = createMockResponse() as Response

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido ou expirado' })
    expect(next).not.toHaveBeenCalled()
  })

  it('attaches decoded user to req.user and calls next on valid token', () => {
    const payload = { userId: 'user-1', email: 'admin@test.com', role: 'admin' }
    const token = generateToken(payload, '30m')
    const req = createMockRequest(`Bearer ${token}`) as Request
    const res = createMockResponse() as Response

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeDefined()
    expect(req.user!.userId).toBe('user-1')
    expect(req.user!.email).toBe('admin@test.com')
    expect(req.user!.role).toBe('admin')
  })

  it('decoded user includes iat and exp fields', () => {
    const payload = { userId: 'user-2', email: 'client@test.com', role: 'client' }
    const token = generateToken(payload, '30m')
    const req = createMockRequest(`Bearer ${token}`) as Request
    const res = createMockResponse() as Response

    authenticate(req, res, next)

    expect(req.user!.iat).toBeTypeOf('number')
    expect(req.user!.exp).toBeTypeOf('number')
    expect(req.user!.exp).toBeGreaterThan(req.user!.iat)
  })
})

describe('requireRole middleware', () => {
  let next: NextFunction

  beforeEach(() => {
    next = vi.fn()
  })

  it('returns 401 when req.user is not set', () => {
    const req = { headers: {} } as Request
    const res = createMockResponse() as Response

    const middleware = requireRole('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token não fornecido' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when user role does not match required role', () => {
    const req = {
      headers: {},
      user: { userId: '1', email: 'client@test.com', role: 'client' as const, iat: 0, exp: 0 },
    } as Request
    const res = createMockResponse() as Response

    const middleware = requireRole('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso não autorizado' })
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when user role matches required role', () => {
    const req = {
      headers: {},
      user: { userId: '1', email: 'admin@test.com', role: 'admin' as const, iat: 0, exp: 0 },
    } as Request
    const res = createMockResponse() as Response

    const middleware = requireRole('admin')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('accepts multiple roles', () => {
    const req = {
      headers: {},
      user: { userId: '1', email: 'client@test.com', role: 'client' as const, iat: 0, exp: 0 },
    } as Request
    const res = createMockResponse() as Response

    const middleware = requireRole('admin', 'client')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})
