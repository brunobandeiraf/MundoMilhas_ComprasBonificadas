import { UserService } from './user.service.js'
import { sendActivationEmail } from './email.service.js'
import { generateToken, generateActivationToken } from '../utils/token.js'
import { hashPassword, comparePassword } from '../utils/password.js'
import { AuthenticationError, RateLimitError, ValidationError } from '../middleware/errorHandler.js'
import { db } from '../config/database.js'

const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_RESEND_COUNT = 5
const RESEND_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

interface ProfileData {
  name?: string
  phone?: string
}

export const AuthService = {
  async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string | null; role: string } }> {
    // Check if login is blocked
    const isBlocked = await UserService.isLoginBlocked(email)
    if (isBlocked) {
      throw new AuthenticationError('Credenciais inválidas')
    }

    // Find user
    const user = await UserService.findByEmail(email)
    if (!user) {
      throw new AuthenticationError('Credenciais inválidas')
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AuthenticationError('Credenciais inválidas')
    }

    // Verify password
    if (!user.passwordHash) {
      throw new AuthenticationError('Credenciais inválidas')
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash)
    if (!isPasswordValid) {
      await UserService.incrementLoginAttempts(email)
      throw new AuthenticationError('Credenciais inválidas')
    }

    // Success: reset attempts and update lastLoginAt
    await UserService.resetLoginAttempts(email)
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email, role: user.role })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  },

  async initiateActivation(email: string): Promise<void> {
    const user = await UserService.findByEmail(email)
    if (!user) {
      throw new ValidationError('Cadastro deve ser feito por um Administrador')
    }

    // Check if already active
    if (user.isActive) {
      throw new ValidationError('Conta já está ativa')
    }

    // Generate 6-digit token
    const token = generateActivationToken()
    const tokenExpiresAt = new Date(Date.now() + TOKEN_VALIDITY_MS)

    // Save token to user
    await db.user.update({
      where: { id: user.id },
      data: {
        activationToken: token,
        tokenExpiresAt,
      },
    })

    // Send activation email
    await sendActivationEmail(user.email, token)
  },

  async validateToken(email: string, token: string): Promise<boolean> {
    const user = await UserService.findByEmail(email)
    if (!user) {
      return false
    }

    // Check token matches
    if (user.activationToken !== token) {
      return false
    }

    // Check token not expired
    if (!user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
      return false
    }

    return true
  },

  async activateAccount(
    email: string,
    token: string,
    password: string,
    profile: ProfileData
  ): Promise<{ token: string; user: { id: string; email: string; name: string | null; role: string } }> {
    // Validate token
    const isValid = await this.validateToken(email, token)
    if (!isValid) {
      throw new ValidationError('Token inválido ou expirado')
    }

    const user = await UserService.findByEmail(email)
    if (!user) {
      throw new ValidationError('Token inválido ou expirado')
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Update user: set password, name, phone, activate, clear token
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        name: profile.name ?? user.name,
        phone: profile.phone ?? user.phone,
        isActive: true,
        activationToken: null,
        tokenExpiresAt: null,
      },
    })

    // Generate JWT
    const jwtToken = generateToken({ userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role })

    return {
      token: jwtToken,
      user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role },
    }
  },

  async resendToken(email: string): Promise<void> {
    const user = await UserService.findByEmail(email)
    if (!user) {
      throw new ValidationError('Cadastro deve ser feito por um Administrador')
    }

    if (user.isActive) {
      throw new ValidationError('Conta já está ativa')
    }

    // Check resend count within 24h window
    const now = new Date()
    let resendCount = user.tokenResendCount

    // Reset count if window has passed
    if (user.tokenResendResetAt && user.tokenResendResetAt <= now) {
      resendCount = 0
    }

    if (resendCount >= MAX_RESEND_COUNT) {
      throw new RateLimitError('Limite de reenvios atingido. Tente novamente em 24 horas.')
    }

    // Generate new token
    const token = generateActivationToken()
    const tokenExpiresAt = new Date(Date.now() + TOKEN_VALIDITY_MS)

    // Set resend reset window if this is the first resend in the window
    const tokenResendResetAt = resendCount === 0
      ? new Date(Date.now() + RESEND_WINDOW_MS)
      : user.tokenResendResetAt

    // Save token and increment resend count
    await db.user.update({
      where: { id: user.id },
      data: {
        activationToken: token,
        tokenExpiresAt,
        tokenResendCount: resendCount + 1,
        tokenResendResetAt,
      },
    })

    // Send activation email
    await sendActivationEmail(user.email, token)
  },
}
