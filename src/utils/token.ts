import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { env } from '../config/env.js'

export function generateToken(payload: object, expiresIn: string | number = '30m'): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] })
}

export function verifyToken(token: string): object {
  return jwt.verify(token, env.JWT_SECRET) as object
}

export function generateActivationToken(): string {
  const num = crypto.randomInt(0, 1_000_000)
  return num.toString().padStart(6, '0')
}
