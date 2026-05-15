import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { createRateLimiter } from '../../../src/middleware/rateLimiter.js'
import { RateLimitError } from '../../../src/middleware/errorHandler.js'

function createMockReq(ip: string = '127.0.0.1'): Request {
  return { ip, socket: { remoteAddress: ip } } as unknown as Request
}

function createMockRes(): Response {
  return {} as Response
}

describe('createRateLimiter', () => {
  let cleanup: () => void

  afterEach(() => {
    cleanup?.()
  })

  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 })
    cleanup = limiter.cleanup

    const req = createMockReq('192.168.1.1')
    const res = createMockRes()
    const next = vi.fn()

    limiter(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('allows exactly maxRequests requests', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 3 })
    cleanup = limiter.cleanup

    const req = createMockReq('10.0.0.1')
    const res = createMockRes()
    const next = vi.fn()

    // 3 requests should all pass
    limiter(req, res, next)
    limiter(req, res, next)
    limiter(req, res, next)

    expect(next).toHaveBeenCalledTimes(3)
    expect(next).toHaveBeenCalledWith()
  })

  it('blocks requests exceeding the limit with RateLimitError', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 })
    cleanup = limiter.cleanup

    const req = createMockReq('10.0.0.2')
    const res = createMockRes()
    const next = vi.fn()

    limiter(req, res, next)
    limiter(req, res, next)
    limiter(req, res, next) // This should be blocked

    expect(next).toHaveBeenCalledTimes(3)
    const thirdCall = next.mock.calls[2]?.[0]
    expect(thirdCall).toBeInstanceOf(RateLimitError)
  })

  it('tracks requests per IP independently', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 })
    cleanup = limiter.cleanup

    const res = createMockRes()
    const next = vi.fn()

    limiter(createMockReq('1.1.1.1'), res, next)
    limiter(createMockReq('2.2.2.2'), res, next)

    // Both should pass since they are different IPs
    expect(next).toHaveBeenCalledTimes(2)
    expect(next).toHaveBeenNthCalledWith(1)
    expect(next).toHaveBeenNthCalledWith(2)
  })

  it('resets count after window expires', () => {
    vi.useFakeTimers()

    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 })
    cleanup = limiter.cleanup

    const req = createMockReq('10.0.0.3')
    const res = createMockRes()
    const next = vi.fn()

    limiter(req, res, next) // passes
    limiter(req, res, next) // blocked

    expect(next).toHaveBeenCalledTimes(2)
    expect(next.mock.calls[1]?.[0]).toBeInstanceOf(RateLimitError)

    // Advance time past the window
    vi.advanceTimersByTime(1001)

    limiter(req, res, next) // should pass again
    expect(next).toHaveBeenCalledTimes(3)
    expect(next.mock.calls[2]?.[0]).toBeUndefined()

    vi.useRealTimers()
  })

  it('uses default options when none provided', () => {
    const limiter = createRateLimiter()
    cleanup = limiter.cleanup

    const req = createMockReq('10.0.0.4')
    const res = createMockRes()
    const next = vi.fn()

    // Should allow at least one request with defaults (100 max)
    limiter(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('falls back to socket.remoteAddress when req.ip is undefined', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 })
    cleanup = limiter.cleanup

    const req = { ip: undefined, socket: { remoteAddress: '172.16.0.1' } } as unknown as Request
    const res = createMockRes()
    const next = vi.fn()

    limiter(req, res, next)
    limiter(req, res, next) // should be blocked for same IP

    expect(next).toHaveBeenCalledTimes(2)
    expect(next.mock.calls[1]?.[0]).toBeInstanceOf(RateLimitError)
  })

  it('uses "unknown" when both ip and remoteAddress are undefined', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 })
    cleanup = limiter.cleanup

    const req = { ip: undefined, socket: { remoteAddress: undefined } } as unknown as Request
    const res = createMockRes()
    const next = vi.fn()

    limiter(req, res, next)
    limiter(req, res, next) // should be blocked

    expect(next).toHaveBeenCalledTimes(2)
    expect(next.mock.calls[1]?.[0]).toBeInstanceOf(RateLimitError)
  })
})
