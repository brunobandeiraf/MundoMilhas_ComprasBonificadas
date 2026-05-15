import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ApiResponseError } from '../services/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/stores')
    } catch (err) {
      if (err instanceof ApiResponseError) {
        if (err.status === 429) {
          setError('Muitas tentativas. Tente novamente em 15 minutos.')
        } else {
          setError('Credenciais inválidas')
        }
      } else {
        setError('Credenciais inválidas')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main aria-labelledby="login-heading">
      <div className="login-container">
        <h1 id="login-heading">Entrar</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
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

          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              aria-required="true"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              placeholder="Sua senha"
            />
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !email || !password}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="activation-link">
          Primeiro acesso?{' '}
          <Link to="/activation">Ativar conta</Link>
        </p>
      </div>
    </main>
  )
}
