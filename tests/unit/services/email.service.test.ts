import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'test-id' }))
const mockCreateTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: mockSendMail })))

vi.mock('../../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    DATABASE_URL: 'file:./test.db',
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@test.com',
    SMTP_PASS: 'test-pass',
    CRON_SCHEDULE: '0 10,17 * * *',
  },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

import { sendActivationEmail } from '../../../src/services/email.service.js'

describe('EmailService', () => {
  beforeEach(() => {
    mockSendMail.mockClear()
  })

  describe('sendActivationEmail', () => {
    it('sends an email with the correct subject', async () => {
      await sendActivationEmail('user@example.com', '123456')

      expect(mockSendMail).toHaveBeenCalledOnce()
      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.subject).toBe('Ativação de Conta - Compras Bonificadas')
    })

    it('sends to the correct recipient', async () => {
      await sendActivationEmail('user@example.com', '123456')

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.to).toBe('user@example.com')
    })

    it('includes the token in the HTML body', async () => {
      await sendActivationEmail('user@example.com', '654321')

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.html).toContain('654321')
    })

    it('sets the from address using SMTP_USER', async () => {
      await sendActivationEmail('user@example.com', '123456')

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.from).toContain('test@test.com')
      expect(callArgs.from).toContain('Compras Bonificadas')
    })

    it('sends HTML content with proper structure', async () => {
      await sendActivationEmail('user@example.com', '999999')

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.html).toContain('<!DOCTYPE html>')
      expect(callArgs.html).toContain('Compras Bonificadas')
      expect(callArgs.html).toContain('24 horas')
    })

    it('configures SMTP transport with correct settings', () => {
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@test.com',
          pass: 'test-pass',
        },
      })
    })
  })
})
