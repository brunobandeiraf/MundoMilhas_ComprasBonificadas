import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  initiateActivation,
  confirmActivation,
  resendToken,
  ApiResponseError,
} from '../services/api'

type Step = 'email' | 'token' | 'password'

/**
 * Aplica máscara de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/**
 * Remove máscara e retorna apenas dígitos
 */
function unformatPhone(value: string): string {
  return value.replace(/\D/g, '')
}

export default function ActivationPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendDisabled, setResendDisabled] = useState(false)

  const { setAuthData } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Auto-fill from URL params (when user clicks link in email)
  useEffect(() => {
    const emailParam = searchParams.get('email')
    const tokenParam = searchParams.get('token')

    if (emailParam) {
      setEmail(emailParam)
      if (tokenParam) {
        setToken(tokenParam)
        setStep('password')
        setInfo('Token preenchido automaticamente. Defina sua senha para ativar a conta.')
      } else {
        setStep('token')
        setInfo('Insira o token de 6 dígitos enviado para seu e-mail.')
      }
    }
  }, [searchParams])

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setIsSubmitting(true)

    try {
      await initiateActivation(email)
      setStep('token')
      setInfo('Token de ativação enviado para seu e-mail.')
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setError(err.message)
      } else {
        setError('Erro ao iniciar ativação. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTokenSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (token.length !== 6) {
      setError('O token deve ter 6 dígitos.')
      return
    }

    setStep('password')
  }

  function validatePasswordForm(): string | null {
    if (password.length < 8) {
      return 'Senha deve ter no mínimo 8 caracteres'
    }
    if (!/[A-Z]/.test(password)) {
      return 'Senha deve conter ao menos uma letra maiúscula'
    }
    if (!/[a-z]/.test(password)) {
      return 'Senha deve conter ao menos uma letra minúscula'
    }
    if (!/[0-9]/.test(password)) {
      return 'Senha deve conter ao menos um número'
    }
    if (password !== confirmPassword) {
      return 'As senhas não coincidem'
    }
    return null
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    const validationError = validatePasswordForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const phoneDigits = unformatPhone(phone)
      const data = await confirmActivation({
        email,
        token,
        password,
        name: name || undefined,
        phone: phoneDigits || undefined,
      })
      setAuthData(data)
      navigate('/stores')
    } catch (err) {
      if (err instanceof ApiResponseError) {
        if (err.message.includes('Token') || err.message.includes('token')) {
          setError('Token inválido ou expirado. Solicite um novo token.')
          setStep('token')
        } else {
          setError(err.message)
        }
      } else {
        setError('Erro ao ativar conta. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendToken() {
    setError('')
    setInfo('')
    setResendDisabled(true)

    try {
      await resendToken(email)
      setInfo('Novo token enviado para seu e-mail.')
    } catch (err) {
      if (err instanceof ApiResponseError) {
        if (err.status === 429) {
          setError('Limite de reenvios atingido. Tente novamente em 24 horas.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Erro ao reenviar token. Tente novamente.')
      }
    } finally {
      setTimeout(() => setResendDisabled(false), 30000)
    }
  }

  return (
    <main aria-labelledby="activation-heading">
      <div className="activation-container">
        <h1 id="activation-heading">Ativar Conta</h1>

        <nav aria-label="Etapas de ativação" className="steps-indicator">
          <ol>
            <li aria-current={step === 'email' ? 'step' : undefined}>
              E-mail
            </li>
            <li aria-current={step === 'token' ? 'step' : undefined}>
              Token
            </li>
            <li aria-current={step === 'password' ? 'step' : undefined}>
              Cadastro
            </li>
          </ol>
        </nav>

        {error && (
          <div role="alert" aria-live="assertive" className="error-message">
            {error}
          </div>
        )}

        {info && (
          <div role="status" aria-live="polite" className="info-message">
            {info}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="activation-email">E-mail</label>
              <input
                id="activation-email"
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                placeholder="seu@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar token'}
            </button>
          </form>
        )}

        {step === 'token' && (
          <form onSubmit={handleTokenSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="activation-token">Token de 6 dígitos</label>
              <input
                id="activation-token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                aria-required="true"
                aria-describedby="token-hint"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isSubmitting}
                placeholder="000000"
                autoFocus
              />
              <small id="token-hint">
                Insira o código de 6 dígitos enviado para {email}
              </small>
            </div>

            <button
              type="submit"
              disabled={token.length !== 6}
            >
              Verificar token
            </button>

            <button
              type="button"
              onClick={handleResendToken}
              disabled={resendDisabled}
              className="btn-secondary"
              aria-label="Reenviar token de ativação"
            >
              {resendDisabled ? 'Aguarde...' : 'Reenviar token'}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="activation-password">Senha *</label>
              <input
                id="activation-password"
                type="password"
                autoComplete="new-password"
                required
                aria-required="true"
                aria-describedby="password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder="Mínimo 8 caracteres"
              />
              <small id="password-hint">
                Mínimo 8 caracteres, com ao menos 1 maiúscula, 1 minúscula e 1 número
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="activation-confirm-password">Confirmar senha *</label>
              <input
                id="activation-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                aria-required="true"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder="Repita a senha"
              />
            </div>

            <div className="form-group">
              <label htmlFor="activation-name">Nome (opcional)</label>
              <input
                id="activation-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Seu nome completo"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="activation-phone">Telefone (opcional)</label>
              <input
                id="activation-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                disabled={isSubmitting}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !password || !confirmPassword}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Ativando...' : 'Ativar conta'}
            </button>
          </form>
        )}

        <p className="login-link">
          Já possui conta?{' '}
          <Link to="/login">Fazer login</Link>
        </p>
      </div>
    </main>
  )
}
