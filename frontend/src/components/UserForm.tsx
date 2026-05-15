import { useState, type FormEvent } from 'react'
import { createUser, ApiResponseError, type CreateUserResponse } from '../services/api'

interface UserFormProps {
  onUserCreated?: () => void
}

export default function UserForm({ onUserCreated }: UserFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sendActivationNow, setSendActivationNow] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<CreateUserResponse | null>(null)

  function resetForm() {
    setEmail('')
    setName('')
    setPhone('')
    setSendActivationNow(false)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setConfirmation(null)
    setIsSubmitting(true)

    try {
      const result = await createUser({
        email,
        name: name || undefined,
        phone: phone || undefined,
        sendActivationNow,
      })
      setConfirmation(result)
      resetForm()
      onUserCreated?.()
    } catch (err) {
      if (err instanceof ApiResponseError) {
        if (err.status === 409) {
          setError('E-mail já cadastrado')
        } else {
          setError(err.message)
        }
      } else {
        setError('Erro ao cadastrar cliente. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate aria-label="Formulário de cadastro de cliente">
        <div className="form-group">
          <label htmlFor="user-email">E-mail *</label>
          <input
            id="user-email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            placeholder="cliente@email.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="user-name">Nome (opcional)</label>
          <input
            id="user-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Nome do cliente"
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label htmlFor="user-phone">Telefone (opcional)</label>
          <input
            id="user-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
            disabled={isSubmitting}
            placeholder="Apenas números"
            maxLength={15}
            inputMode="numeric"
          />
        </div>

        <div className="form-group">
          <label htmlFor="user-send-activation">
            <input
              id="user-send-activation"
              type="checkbox"
              checked={sendActivationNow}
              onChange={(e) => setSendActivationNow(e.target.checked)}
              disabled={isSubmitting}
            />
            {' '}Enviar e-mail de ativação imediatamente
          </label>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="error-message">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !email}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Cadastrando...' : 'Cadastrar Cliente'}
        </button>
      </form>

      {confirmation && (
        <div role="status" aria-live="polite" className="confirmation-message">
          <p>
            <strong>Cliente cadastrado com sucesso!</strong>
          </p>
          <p>E-mail: {confirmation.user.email}</p>
          <p>
            Status de ativação:{' '}
            {confirmation.user.activationStatus === 'sent'
              ? 'E-mail de ativação enviado'
              : 'Pendente (e-mail não enviado)'}
          </p>
        </div>
      )}
    </div>
  )
}
