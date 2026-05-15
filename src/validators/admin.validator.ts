import { z } from 'zod/v4'

export const createUserSchema = z.object({
  email: z.email().max(254),
  name: z.string().max(100).optional(),
  phone: z
    .string()
    .max(15)
    .regex(/^\d+$/, 'Phone must contain only digits')
    .optional(),
  sendActivationNow: z.boolean(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const createProgramSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
})

export type CreateProgramInput = z.infer<typeof createProgramSchema>
