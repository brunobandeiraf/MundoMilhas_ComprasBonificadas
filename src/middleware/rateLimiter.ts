import type { Request, Response, NextFunction } from 'express'
import { RateLimitError } from './errorHandler.js'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimiterOptions {
  windowMs: number
  maxRequests: number
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
}

export function createRateLimiter(options: Partial<RateLimiterOptions> = {}) {
  const { windowMs, maxRequests } = { ...DEFAULT_OPTIONS, ...options }
  const store = new Map<string, RateLimitEntry>()

  // Periodically clean up expired entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key)
      }
    }
  }, windowMs)

  // Allow the timer to not prevent process exit
  cleanupInterval.unref()

  function middleware(req: Request, _res: Response, next: NextFunction): void {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()

    const entry = store.get(ip)

    if (!entry || now >= entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (entry.count >= maxRequests) {
      next(new RateLimitError())
      return
    }

    entry.count++
    next()
  }

  // Expose for testing
  middleware.store = store
  middleware.cleanup = () => clearInterval(cleanupInterval)

  return middleware
}
