import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../config/env.js'

const isDevMode = env.SMTP_HOST === 'smtp.example.com' || env.SMTP_HOST === 'localhost'

let transporter: Transporter | null = null

if (!isDevMode) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })
}

function buildActivationHtml(to: string, token: string): string {
  const activationLink = `${env.APP_URL}/activation?email=${encodeURIComponent(to)}&token=${token}`

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Compras Bonificadas</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header azul -->
          <tr>
            <td style="background-color:#1a73e8;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Compras Bonificadas</h1>
            </td>
          </tr>
          <!-- Conteúdo -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#333333;font-size:18px;font-weight:600;">
                Olá! Você foi convidado(a) para o Compras Bonificadas.
              </p>
              <p style="margin:0 0 24px;color:#555555;font-size:15px;line-height:1.6;">
                Uma conta foi criada para você. Para começar a usar a plataforma e acompanhar as melhores promoções de compras bonificadas, ative sua conta clicando no botão abaixo:
              </p>

              <!-- Botão de ativação -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background-color:#1a73e8;border-radius:8px;">
                    <a href="${activationLink}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                      Ativar minha conta
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Token -->
              <p style="margin:0 0 8px;color:#555555;font-size:14px;">
                Ou use o código de ativação abaixo:
              </p>
              <div style="text-align:center;margin:0 0 32px;">
                <span style="display:inline-block;font-size:28px;font-weight:bold;letter-spacing:6px;color:#1a73e8;background-color:#e8f0fe;padding:12px 24px;border-radius:8px;">${token}</span>
              </div>

              <!-- Informações -->
              <div style="background-color:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#333;font-size:13px;font-weight:600;">O que você vai precisar:</p>
                <ul style="margin:0;padding-left:20px;color:#555;font-size:13px;line-height:1.8;">
                  <li>Criar uma senha (mínimo 8 caracteres)</li>
                  <li>Informar seu nome (opcional)</li>
                  <li>Informar seu telefone (opcional)</li>
                </ul>
              </div>

              <p style="margin:0;color:#999999;font-size:12px;">
                Este convite é válido por <strong>24 horas</strong>. Se você não reconhece este e-mail, ignore-o.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #eeeeee;text-align:center;">
              <p style="margin:0;color:#999999;font-size:11px;">
                Compras Bonificadas &copy; ${new Date().getFullYear()} — Plataforma de promoções de programas de fidelidade
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

export async function sendActivationEmail(to: string, token: string): Promise<void> {
  const activationLink = `${env.APP_URL}/activation?email=${encodeURIComponent(to)}&token=${token}`

  if (isDevMode) {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║           📧 E-MAIL DE ATIVAÇÃO (DEV MODE)              ║')
    console.log('╠══════════════════════════════════════════════════════════╣')
    console.log(`║  Para: ${to}`)
    console.log(`║  Token: ${token}`)
    console.log(`║  Link: ${activationLink}`)
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log('')
    return
  }

  await transporter!.sendMail({
    from: `"Compras Bonificadas" <${env.SMTP_USER}>`,
    to,
    subject: 'Você foi convidado(a) para o Compras Bonificadas',
    html: buildActivationHtml(to, token),
  })
}
