import { db } from '../config/database.js'
import { ConflictError } from '../middleware/errorHandler.js'

const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

interface CreateUserInput {
  email: string
  name?: string
  phone?: string
  sendActivationNow: boolean
}

interface UpdateProfileInput {
  name?: string
  phone?: string
}

export const UserService = {
  async createUser(data: CreateUserInput) {
    const normalizedEmail = data.email.toLowerCase()

    const existingUser = await db.user.findFirst({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      throw new ConflictError('E-mail já cadastrado')
    }

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: data.name ?? null,
        phone: data.phone ?? null,
      },
    })

    return user
  },

  async findByEmail(email: string) {
    const normalizedEmail = email.toLowerCase()

    const user = await db.user.findFirst({
      where: { email: normalizedEmail },
    })

    return user
  },

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
      },
    })

    return user
  },

  async incrementLoginAttempts(email: string) {
    const normalizedEmail = email.toLowerCase()

    const user = await db.user.findFirst({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return 0
    }

    const newAttempts = user.loginAttempts + 1
    const updateData: { loginAttempts: number; loginBlockedUntil?: Date } = {
      loginAttempts: newAttempts,
    }

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.loginBlockedUntil = new Date(Date.now() + LOGIN_BLOCK_DURATION_MS)
    }

    await db.user.update({
      where: { id: user.id },
      data: updateData,
    })

    return newAttempts
  },

  async resetLoginAttempts(email: string) {
    const normalizedEmail = email.toLowerCase()

    const user = await db.user.findFirst({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        loginBlockedUntil: null,
      },
    })
  },

  async isLoginBlocked(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase()

    const user = await db.user.findFirst({
      where: { email: normalizedEmail },
    })

    if (!user || !user.loginBlockedUntil) {
      return false
    }

    return user.loginBlockedUntil > new Date()
  },
}
