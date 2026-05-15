import { useState, useEffect, useCallback } from 'react'
import { getUsers, toggleUserStatus, deleteUser, type UserItem } from '../services/api'
import UserForm from '../components/UserForm'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getUsers()
      if (Array.isArray(response)) {
        setUsers(response as unknown as UserItem[])
      } else {
        setUsers((response as { data: UserItem[] }).data || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleToggleStatus(userId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setTogglingId(userId)
    try {
      const updated = await toggleUserStatus(userId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: updated.isActive } : u)))
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, isActive: updated.isActive })
      }
    } catch {
      // silently fail
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDeleteUser(userId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return
    try {
      await deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      if (selectedUser?.id === userId) setSelectedUser(null)
    } catch {
      alert('Não é possível excluir um usuário ativo.')
    }
  }

  const filteredUsers = users.filter((user) => {
    // Status filter
    if (statusFilter === 'active' && !user.isActive) return false
    if (statusFilter === 'inactive' && user.isActive) return false

    // Search filter
    if (!search) return true
    const s = search.toLowerCase()
    return (
      user.email.toLowerCase().includes(s) ||
      (user.name || '').toLowerCase().includes(s) ||
      (user.phone || '').includes(s)
    )
  })

  const activeCount = users.filter((u) => u.isActive).length
  const inactiveCount = users.filter((u) => !u.isActive).length

  return (
    <main className="users-page">
      <div className="users-container">
        <div className="users-header">
          <div>
            <h1>Usuários</h1>
            <p className="users-subtitle">
              {filteredUsers.length} de {users.length} usuários
            </p>
          </div>
          <button className="btn-new-user" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Fechar' : '+ Novo Usuário'}
          </button>
        </div>

        {showForm && (
          <div className="users-form-panel">
            <h2>Cadastrar Novo Cliente</h2>
            <UserForm onUserCreated={() => { loadUsers(); setShowForm(false) }} />
          </div>
        )}

        {/* Filtros */}
        <div className="users-filters">
          <div className="users-search">
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="users-search__input"
            />
            {search && (
              <button className="users-search__clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <div className="users-status-filter">
            <button
              className={`status-btn ${statusFilter === 'all' ? 'status-btn--active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Todos ({users.length})
            </button>
            <button
              className={`status-btn ${statusFilter === 'active' ? 'status-btn--active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Ativos ({activeCount})
            </button>
            <button
              className={`status-btn ${statusFilter === 'inactive' ? 'status-btn--active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              Pendentes ({inactiveCount})
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="users-loading">
            <div className="spinner" />
            <p>Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-empty">
            <p>{search || statusFilter !== 'all' ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}</p>
          </div>
        ) : (
          <div className="users-list">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`user-card ${selectedUser?.id === user.id ? 'user-card--selected' : ''}`}
                onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
              >
                <div className="user-card__main">
                  <div className="user-card__avatar">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="user-card__info">
                    <span className="user-card__name">{user.name || '—'}</span>
                    <span className="user-card__email">{user.email}</span>
                  </div>
                  <div className="user-card__badges">
                    <span className={`badge ${user.role === 'admin' ? 'badge--admin' : 'badge--client'}`}>
                      {user.role}
                    </span>
                    <span className={`badge ${user.isActive ? 'badge--active' : 'badge--inactive'}`}>
                      {user.isActive ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>
                  <button
                    className={`btn-toggle-status ${user.isActive ? 'btn-toggle-status--deactivate' : 'btn-toggle-status--activate'}`}
                    onClick={(e) => handleToggleStatus(user.id, e)}
                    disabled={togglingId === user.id}
                  >
                    {togglingId === user.id ? '...' : user.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  {!user.isActive && (
                    <button
                      className="btn-delete-user"
                      onClick={(e) => handleDeleteUser(user.id, e)}
                      title="Excluir usuário pendente"
                    >
                      🗑
                    </button>
                  )}
                </div>

                {selectedUser?.id === user.id && (
                  <div className="user-card__details">
                    <div className="user-card__detail-row">
                      <span className="user-card__detail-label">E-mail</span>
                      <span className="user-card__detail-value">{user.email}</span>
                    </div>
                    <div className="user-card__detail-row">
                      <span className="user-card__detail-label">Nome</span>
                      <span className="user-card__detail-value">{user.name || 'Não informado'}</span>
                    </div>
                    <div className="user-card__detail-row">
                      <span className="user-card__detail-label">Telefone</span>
                      <span className="user-card__detail-value">{user.phone || 'Não informado'}</span>
                    </div>
                    <div className="user-card__detail-row">
                      <span className="user-card__detail-label">Role</span>
                      <span className="user-card__detail-value">{user.role}</span>
                    </div>
                    <div className="user-card__detail-row">
                      <span className="user-card__detail-label">Status</span>
                      <span className="user-card__detail-value">
                        {user.isActive ? 'Conta ativa' : 'Aguardando ativação'}
                      </span>
                    </div>
                    <div className="user-card__detail-row">
                      <span className="user-card__detail-label">Cadastrado em</span>
                      <span className="user-card__detail-value">
                        {new Date(user.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
