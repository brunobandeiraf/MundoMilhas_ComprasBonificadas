import { z } from 'zod/v4'

// --- Email validation ---
const emailSchema = z
  .string()
  .max(254)
  .refine(
    (val) => {
      const atIndex = val.indexOf('@')
      if (atIndex === -1) return false
      // Exactly one "@"
      if (val.indexOf('@', atIndex + 1) !== -1) return false
      const local = val.slice(0, atIndex)
      const domain = val.slice(atIndex + 1)
      return local.length > 0 && domain.length > 0
    },
    { message: 'E-mail com formato inválido' }
  )

// --- Password validation ---
const passwordSchema = z
  .string()
  .min(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Senha deve conter ao menos uma letra maiúscula',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'Senha deve conter ao menos uma letra minúscula',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Senha deve conter ao menos um número',
  })

// --- Schemas ---

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Senha é obrigatória' }),
})

export const initiateActivationSchema = z.object({
  email: emailSchema,
})

export const confirmActivationSchema = z.object({
  email: emailSchema,
  token: z
    .string()
    .regex(/^\d{6}$/, { message: 'Token deve conter exatamente 6 dígitos' }),
  password: passwordSchema,
  name: z.string().max(100).optional(),
  phone: z
    .string()
    .max(15)
    .regex(/^\d*$/, { message: 'Telefone deve conter apenas dígitos' })
    .optional(),
})

export const resendTokenSchema = z.object({
  email: emailSchema,
})

// --- Inferred types ---

export type LoginInput = z.infer<typeof loginSchema>
export type InitiateActivationInput = z.infer<typeof initiateActivationSchema>
export type ConfirmActivationInput = z.infer<typeof confirmActivationSchema>
export type ResendTokenInput = z.infer<typeof resendTokenSchema>
