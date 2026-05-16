import { useState, useEffect, useCallback } from 'react'
import {
  getPrograms,
  getUsers,
  createProgram,
  updateProgram,
  toggleUserStatus,
  deleteUser,
  updateUser,
  runCrawler,
  runCrawlerForProgram,
  getCrawlerSchedule,
  getCrawlerStatus,
  updateCrawlerSchedule,
  getCrawlerHistory,
  getAdminStores,
  updateStoreCategory,
  mergeStores,
  ApiResponseError,
  type ProgramItem,
  type UserItem,
  type AdminStoreItem,
  type CrawlerRunResponse,
  type CrawlLogItem,
} from '../services/api'
import UserForm from '../components/UserForm'

type Tab = 'users' | 'stores' | 'crawler' | 'history' | 'programs'

type StatusFilter = 'all' | 'active' | 'inactive'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
  return `${mins}m ${secs}s`
}

interface CrawlerLog {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error'
}

function cronToTime(cron: string): { hour: string; minute: string } {
  const parts = cron.split(' ')
  return { minute: parts[0] || '0', hour: parts[1] || '12' }
}

function timeToCron(hour: string, minute: string): string {
  return `${minute} ${hour} * * *`
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  // Users state
  const [users, setUsers] = useState<UserItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [showUserForm, setShowUserForm] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Programs state
  const [programs, setPrograms] = useState<ProgramItem[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [crawlerRunning, setCrawlerRunning] = useState(false)
  const [crawlerRunningProgram, setCrawlerRunningProgram] = useState<string | null>(null)
  const [runningPrograms, setRunningPrograms] = useState<string[]>([])
  const [crawlerProgress, setCrawlerProgress] = useState<Record<string, { current: number; total: number }>>({})
  const [crawlerStartTimes, setCrawlerStartTimes] = useState<Record<string, number>>({})

  const [programName, setProgramName] = useState('')
  const [programUrl, setProgramUrl] = useState('')
  const [programError, setProgramError] = useState('')
  const [programSuccess, setProgramSuccess] = useState('')
  const [editingProgram, setEditingProgram] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState('')

  const [crawlerResult, setCrawlerResult] = useState<CrawlerRunResponse | null>(null)
  const [crawlerError, setCrawlerError] = useState('')
  const [crawlerLogs, setCrawlerLogs] = useState<CrawlerLog[]>([])

  // Schedule
  const [scheduleHour, setScheduleHour] = useState('12')
  const [scheduleMinute, setScheduleMinute] = useState('00')
  const [scheduleMsg, setScheduleMsg] = useState('')
  const [scheduleError, setScheduleError] = useState('')

  // History
  const [history, setHistory] = useState<CrawlLogItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyLimit, setHistoryLimit] = useState(10)

  const addLog = (message: string, type: CrawlerLog['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR')
    setCrawlerLogs((prev) => [...prev, { timestamp, message, type }])
  }

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const response = await getUsers()
      if (Array.isArray(response)) setUsers(response as unknown as UserItem[])
      else setUsers((response as { data: UserItem[] }).data || [])
    } catch {} finally { setUsersLoading(false) }
  }, [])

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true)
    try { setPrograms(await getPrograms()) } catch {} finally { setProgramsLoading(false) }
  }, [])

  const loadSchedule = useCallback(async () => {
    try {
      const data = await getCrawlerSchedule()
      const { hour, minute } = cronToTime(data.schedule)
      setScheduleHour(hour)
      setScheduleMinute(minute)
    } catch {}
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try { setHistory(await getCrawlerHistory()) } catch {} finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { loadUsers(); loadPrograms(); loadSchedule(); loadHistory() }, [loadUsers, loadPrograms, loadSchedule, loadHistory])

  // Poll crawler status every 5 seconds + refresh program store counts
  useEffect(() => {
    const checkStatus = () => {
      getCrawlerStatus().then((data) => {
        setRunningPrograms(data.running)
        setCrawlerProgress(data.progress || {})
        setCrawlerStartTimes(data.startTimes || {})
      }).catch(() => {})
    }
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [loadPrograms])
  useEffect(() => { if (activeTab === 'history') loadHistory() }, [activeTab, loadHistory])

  async function handleSaveSchedule() {
    setScheduleMsg(''); setScheduleError('')
    const cron = timeToCron(scheduleHour, scheduleMinute)
    try {
      await updateCrawlerSchedule(cron)
      setScheduleMsg(`Horário salvo: ${scheduleHour.padStart(2, '0')}:${scheduleMinute.padStart(2, '0')}`)
    } catch (err) {
      setScheduleError(err instanceof ApiResponseError ? err.message : 'Erro ao salvar.')
    }
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault()
    setProgramError(''); setProgramSuccess('')
    if (!programName || !programUrl) return
    try {
      await createProgram({ name: programName, url: programUrl })
      setProgramSuccess(`Programa "${programName}" criado.`)
      setProgramName(''); setProgramUrl('')
      loadPrograms()
    } catch (err) {
      setProgramError(err instanceof ApiResponseError ? err.message : 'Erro.')
    }
  }

  async function handleToggleProgram(id: string, currentActive: boolean) {
    try {
      await updateProgram(id, { isActive: !currentActive })
      loadPrograms()
    } catch {}
  }

  async function handleSaveUrl(id: string) {
    try {
      await updateProgram(id, { url: editUrl })
      setEditingProgram(null)
      loadPrograms()
    } catch {}
  }

  async function handleRunCrawler() {
    setCrawlerError(''); setCrawlerResult(null); setCrawlerRunning(true); setCrawlerLogs([])
    addLog('Iniciando crawler...')
    try {
      const result = await runCrawler()
      setCrawlerResult(result)
      for (const r of result.results) {
        if (r.status === 'success') addLog(`✓ ${r.programName}: ${r.storesFound} lojas`, 'success')
        else addLog(`✗ ${r.programName}: ${r.errorMessage || 'Erro'}`, 'error')
      }
      addLog('Finalizado.', 'success')
    } catch (err) {
      const msg = err instanceof ApiResponseError ? err.message : 'Erro'
      setCrawlerError(msg); addLog(msg, 'error')
    } finally { setCrawlerRunning(false) }
  }

  async function handleRunCrawlerForProgram(programId: string, name: string) {
    setCrawlerError(''); setCrawlerRunningProgram(programId)
    addLog(`Executando "${name}"...`)
    try {
      const result = await runCrawlerForProgram(programId)
      setCrawlerResult(result)
      for (const r of result.results) {
        if (r.status === 'success') addLog(`✓ ${r.programName}: ${r.storesFound} lojas`, 'success')
        else addLog(`✗ ${r.programName}: ${r.errorMessage || 'Erro'}`, 'error')
      }
    } catch (err) {
      addLog(`Erro: ${err instanceof ApiResponseError ? err.message : 'Erro'}`, 'error')
    } finally { setCrawlerRunningProgram(null) }
  }

  function getLastExecution(programName: string): CrawlLogItem | undefined {
    return history.find((h) => h.programName === programName)
  }

  return (
    <main className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <h1>Painel Administrativo</h1>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'users' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('users')}>
            👥 Usuários
          </button>
          <button className={`admin-tab ${activeTab === 'stores' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('stores')}>
            🏪 Lojas
          </button>
          <button className={`admin-tab ${activeTab === 'crawler' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('crawler')}>
            🔄 Crawler
          </button>
          <button className={`admin-tab ${activeTab === 'history' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('history')}>
            📋 Histórico
          </button>
          <button className={`admin-tab ${activeTab === 'programs' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('programs')}>
            🏷️ Programas
          </button>
        </div>

        {/* TAB: Usuários */}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            loading={usersLoading}
            search={userSearch}
            setSearch={setUserSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            showForm={showUserForm}
            setShowForm={setShowUserForm}
            togglingId={togglingId}
            onToggleStatus={async (userId) => {
              setTogglingId(userId)
              try {
                const updated = await toggleUserStatus(userId)
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: updated.isActive } : u)))
                if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, isActive: updated.isActive })
              } catch {} finally { setTogglingId(null) }
            }}
            onDeleteUser={async (userId) => {
              if (!confirm('Tem certeza que deseja excluir este usuário?')) return
              try {
                await deleteUser(userId)
                setUsers((prev) => prev.filter((u) => u.id !== userId))
                if (selectedUser?.id === userId) setSelectedUser(null)
              } catch { alert('Não é possível excluir um usuário ativo.') }
            }}
            onUserCreated={() => { loadUsers(); setShowUserForm(false) }}
          />
        )}

        {/* TAB: Lojas */}
        {activeTab === 'stores' && <StoresManagementTab />}

        {/* TAB: Crawler */}
        {activeTab === 'crawler' && (
          <div className="admin-panel">
            <div className="admin-panel__section">
              <h2>Horário de Execução Automática</h2>
              <p className="admin-description">
                O crawler roda diariamente no horário configurado (Brasília).
              </p>
              <div className="schedule-picker">
                <div className="schedule-picker__inputs">
                  <div className="schedule-picker__field">
                    <label htmlFor="schedule-hour">Hora</label>
                    <select id="schedule-hour" value={scheduleHour} onChange={(e) => setScheduleHour(e.target.value)}>
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={String(i)}>{String(i).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <span className="schedule-picker__separator">:</span>
                  <div className="schedule-picker__field">
                    <label htmlFor="schedule-minute">Minuto</label>
                    <select id="schedule-minute" value={scheduleMinute} onChange={(e) => setScheduleMinute(e.target.value)}>
                      {['00', '15', '30', '45'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleSaveSchedule} className="btn-save-schedule">
                    Salvar
                  </button>
                </div>
                <p className="schedule-picker__current">
                  Agendado para: <strong>{scheduleHour.padStart(2, '0')}:{scheduleMinute.padStart(2, '0')}</strong> (Brasília)
                </p>
                {scheduleError && <div className="error-message">{scheduleError}</div>}
                {scheduleMsg && <div className="success-message">{scheduleMsg}</div>}
              </div>
            </div>

            <div className="admin-panel__section">
              <h2>Executar Agora</h2>
              <div className="crawler-actions">
                <button onClick={handleRunCrawler} disabled={crawlerRunning} className="btn-crawler">
                  {crawlerRunning ? <><span className="spinner-small" /> Executando...</> : '🔄 Executar Todos'}
                </button>
              </div>

              {programs.length > 0 && (
                <div className="crawler-programs">
                  <h3>Por Programa</h3>
                  <div className="crawler-program-list">
                    {programs.map((program) => {
                      const last = getLastExecution(program.name)
                      return (
                        <div key={program.id} className="crawler-program-item">
                          <div className="crawler-program-info">
                            <span className="crawler-program-name">{program.name} <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>
                              {crawlerProgress[program.id]
                                ? `(${crawlerProgress[program.id].current}/${crawlerProgress[program.id].total})`
                                : `(${program.storeCount ?? 0} lojas)`}
                            </span></span>
                            {last && (
                              <span className="crawler-program-last">
                                Última: {new Date(last.completedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                                {' — '}
                                <span className={last.status === 'success' ? 'text-success' : 'text-error'}>
                                  {last.status === 'success' ? `${last.storesFound} lojas` : 'Erro'}
                                </span>
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRunCrawlerForProgram(program.id, program.name)}
                            disabled={crawlerRunningProgram === program.id || runningPrograms.includes(program.id)}
                            className="btn-crawler-small"
                            title={`Executar crawler para ${program.name}`}
                          >
                            {(crawlerRunningProgram === program.id || runningPrograms.includes(program.id)) ? (
                              <><span className="spinner-small" /> Executando...</>
                            ) : '▶ Executar'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {crawlerError && <div className="error-message">{crawlerError}</div>}
              {crawlerResult && (
                <div className="crawler-results">
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead><tr><th>Programa</th><th>Status</th><th>Lojas</th><th>Detalhes</th></tr></thead>
                      <tbody>
                        {crawlerResult.results.map((r, idx) => (
                          <tr key={idx}>
                            <td className="td-bold">{r.programName}</td>
                            <td><span className={`badge ${r.status === 'success' ? 'badge--active' : 'badge--error'}`}>{r.status === 'success' ? '✓' : '✗'}</span></td>
                            <td>{r.storesFound}</td>
                            <td>{r.errorMessage || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* Terminal de logs - sempre visível */}
              <div className="crawler-logs" style={{ marginTop: '1.5rem' }}>
                <h3>Terminal</h3>
                <div className="crawler-logs__container">
                  {/* Show running programs at the top */}
                  {runningPrograms.length > 0 && (
                    <div className="crawler-log crawler-log--info">
                      <span className="crawler-log__time">⏳</span>
                      <span className="crawler-log__msg">
                        Em execução: {programs.filter(p => runningPrograms.includes(p.id)).map(p => {
                          const prog = crawlerProgress[p.id]
                          return prog ? `${p.name} (${prog.current}/${prog.total})` : p.name
                        }).join(', ')}
                      </span>
                    </div>
                  )}
                  {crawlerLogs.length > 0 ? (
                    crawlerLogs.map((log, idx) => (
                      <div key={idx} className={`crawler-log crawler-log--${log.type}`}>
                        <span className="crawler-log__time">{log.timestamp}</span>
                        <span className="crawler-log__msg">{log.message}</span>
                      </div>
                    ))
                  ) : history.length > 0 ? (
                    history.slice(0, 10).map((log) => {
                      const time = new Date(log.completedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                      const isSuccess = log.status === 'success'
                      return (
                        <div key={log.id} className={`crawler-log crawler-log--${isSuccess ? 'success' : 'error'}`}>
                          <span className="crawler-log__time">{time}</span>
                          <span className="crawler-log__msg">
                            {isSuccess ? '✓' : '✗'} {log.programName}: {isSuccess ? `${log.storesFound} lojas` : log.errorMessage}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="crawler-log crawler-log--info">
                      <span className="crawler-log__time">--:--:--</span>
                      <span className="crawler-log__msg">Nenhuma execução registrada.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Programas */}
        {activeTab === 'programs' && (
          <div className="admin-panel">
            <div className="admin-panel__section">
              <h2>Adicionar Programa</h2>
              <form onSubmit={handleCreateProgram} noValidate className="admin-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="program-name">Nome *</label>
                    <input id="program-name" type="text" required value={programName}
                      onChange={(e) => setProgramName(e.target.value)} placeholder="Ex: Livelo" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="program-url">URL *</label>
                    <input id="program-url" type="url" required value={programUrl}
                      onChange={(e) => setProgramUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <button type="submit" disabled={!programName || !programUrl} className="btn-add-program">Adicionar</button>
                </div>
                {programError && <div className="error-message">{programError}</div>}
                {programSuccess && <div className="success-message">{programSuccess}</div>}
              </form>
            </div>

            <div className="admin-panel__section">
              <h2>Programas ({programs.length})</h2>
              {programsLoading ? <p className="admin-loading">Carregando...</p> : programs.length === 0 ? <p className="admin-empty">Nenhum programa.</p> : (
                <div className="program-list">
                  {programs.map((p) => (
                    <div key={p.id} className={`program-card ${!p.isActive ? 'program-card--inactive' : ''}`}>
                      <div className="program-card__main">
                        <div className="program-card__info">
                          <span className="program-card__name">{p.name} <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>({p.storeCount ?? 0} lojas)</span></span>
                          {editingProgram === p.id ? (
                            <div className="program-card__edit-url">
                              <input
                                type="url"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                placeholder="Nova URL"
                                className="program-card__url-input"
                              />
                              <button onClick={() => handleSaveUrl(p.id)} className="btn-save-url">Salvar</button>
                              <button onClick={() => setEditingProgram(null)} className="btn-cancel-url">Cancelar</button>
                            </div>
                          ) : (
                            <span className="program-card__url">
                              <a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
                              <button onClick={() => { setEditingProgram(p.id); setEditUrl(p.url) }} className="btn-edit-url">✎</button>
                            </span>
                          )}
                        </div>
                        <div className="program-card__actions">
                          <span className={`badge ${p.isActive ? 'badge--active' : 'badge--inactive'}`}>
                            {p.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            onClick={() => handleToggleProgram(p.id, p.isActive)}
                            className={`btn-toggle-status ${p.isActive ? 'btn-toggle-status--deactivate' : 'btn-toggle-status--activate'}`}
                          >
                            {p.isActive ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Histórico */}
        {activeTab === 'history' && (
          <div className="admin-panel">
            <div className="admin-panel__section">
              <h2>Histórico de Execuções</h2>

              {/* Running status */}
              {runningPrograms.length > 0 && (
                <div className="info-message" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner-small" style={{ borderTopColor: '#1a73e8', borderColor: '#e5e7eb' }} />
                  Em execução: <strong>{programs.filter(p => runningPrograms.includes(p.id)).map(p => p.name).join(', ')}</strong>
                  <RunningTimer startTime={Object.values(crawlerStartTimes)[0]} />
                </div>
              )}

              {historyLoading ? <p className="admin-loading">Carregando...</p> : history.length === 0 ? <p className="admin-empty">Nenhuma execução.</p> : (
                <>
                  <p className="stores-showing" style={{ marginBottom: '1rem' }}>
                    Mostrando <strong>{Math.min(historyLimit, history.length - (historyPage - 1) * historyLimit)}</strong> de <strong>{history.length}</strong> execuções
                  </p>
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Data/Hora</th><th>Programa</th><th>Status</th><th>Lojas</th><th>Duração</th><th>Erro</th></tr>
                      </thead>
                      <tbody>
                        {history.slice((historyPage - 1) * historyLimit, historyPage * historyLimit).map((log) => {
                          const duration = Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)
                          return (
                            <tr key={log.id}>
                              <td>{new Date(log.completedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                              <td className="td-bold">{log.programName}</td>
                              <td><span className={`badge ${log.status === 'success' ? 'badge--active' : 'badge--error'}`}>{log.status === 'success' ? '✓' : '✗'}</span></td>
                              <td>{log.storesFound}</td>
                              <td>{formatDuration(duration)}</td>
                              <td>{log.errorMessage || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <nav className="pagination" style={{ marginTop: '1rem' }}>
                    <div className="pagination__controls">
                      <button className="pagination__button" onClick={() => setHistoryPage((p) => p - 1)} disabled={historyPage <= 1}>← Anterior</button>
                      <span className="pagination__info">Página {historyPage} de {Math.ceil(history.length / historyLimit)}</span>
                      <button className="pagination__button" onClick={() => setHistoryPage((p) => p + 1)} disabled={historyPage >= Math.ceil(history.length / historyLimit)}>Próxima →</button>
                    </div>
                    <div className="pagination__limit">
                      <label htmlFor="history-limit">Itens:</label>
                      <select id="history-limit" value={historyLimit} onChange={(e) => { setHistoryLimit(Number(e.target.value)); setHistoryPage(1) }} className="pagination__limit-select">
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </nav>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// Users Tab Component
function UsersTab({
  users, loading, search, setSearch, statusFilter, setStatusFilter,
  selectedUser, setSelectedUser, showForm, setShowForm, togglingId,
  onToggleStatus, onDeleteUser, onUserCreated,
}: {
  users: UserItem[]
  loading: boolean
  search: string
  setSearch: (v: string) => void
  statusFilter: StatusFilter
  setStatusFilter: (v: StatusFilter) => void
  selectedUser: UserItem | null
  setSelectedUser: (v: UserItem | null) => void
  showForm: boolean
  setShowForm: (v: boolean) => void
  togglingId: string | null
  onToggleStatus: (id: string) => void
  onDeleteUser: (id: string) => void
  onUserCreated: () => void
}) {
  const filteredUsers = users.filter((user) => {
    if (statusFilter === 'active' && !user.isActive) return false
    if (statusFilter === 'inactive' && user.isActive) return false
    if (!search) return true
    const s = search.toLowerCase()
    return user.email.toLowerCase().includes(s) || (user.name || '').toLowerCase().includes(s) || (user.phone || '').includes(s)
  })

  const activeCount = users.filter((u) => u.isActive).length
  const inactiveCount = users.filter((u) => !u.isActive).length

  return (
    <div className="admin-panel">
      <div className="admin-panel__section">
        <div className="users-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2 style={{ border: 'none', padding: 0, margin: 0 }}>Usuários ({filteredUsers.length})</h2>
          </div>
          <button className="btn-new-user" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Fechar' : '+ Novo'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f0f0f0' }}>
            <UserForm onUserCreated={onUserCreated} />
          </div>
        )}

        <div className="users-filters">
          <div className="users-search">
            <input type="text" placeholder="Buscar..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="users-search__input" />
          </div>
          <div className="users-status-filter">
            <button className={`status-btn ${statusFilter === 'all' ? 'status-btn--active' : ''}`} onClick={() => setStatusFilter('all')}>Todos ({users.length})</button>
            <button className={`status-btn ${statusFilter === 'active' ? 'status-btn--active' : ''}`} onClick={() => setStatusFilter('active')}>Ativos ({activeCount})</button>
            <button className={`status-btn ${statusFilter === 'inactive' ? 'status-btn--active' : ''}`} onClick={() => setStatusFilter('inactive')}>Pendentes ({inactiveCount})</button>
          </div>
        </div>

        {loading ? (
          <p className="admin-loading">Carregando...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="admin-empty">Nenhum usuário encontrado.</p>
        ) : (
          <div className="users-list">
            {filteredUsers.map((user) => (
              <div key={user.id} className={`user-card ${selectedUser?.id === user.id ? 'user-card--selected' : ''}`}
                onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}>
                <div className="user-card__main">
                  <div className="user-card__avatar">{(user.name || user.email).charAt(0).toUpperCase()}</div>
                  <div className="user-card__info">
                    <span className="user-card__name">{user.name || '—'}</span>
                    <span className="user-card__email">{user.email}</span>
                  </div>
                  <div className="user-card__badges">
                    <span className={`badge ${user.role === 'admin' ? 'badge--admin' : 'badge--client'}`}>{user.role}</span>
                    <span className={`badge ${user.isActive ? 'badge--active' : 'badge--inactive'}`}>{user.isActive ? 'Ativo' : 'Pendente'}</span>
                  </div>
                  <button className={`btn-toggle-status ${user.isActive ? 'btn-toggle-status--deactivate' : 'btn-toggle-status--activate'}`}
                    onClick={(e) => { e.stopPropagation(); onToggleStatus(user.id) }} disabled={togglingId === user.id}>
                    {togglingId === user.id ? '...' : user.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  {!user.isActive && (
                    <button className="btn-delete-user" onClick={(e) => { e.stopPropagation(); onDeleteUser(user.id) }} title="Excluir">🗑</button>
                  )}
                </div>
                {selectedUser?.id === user.id && (
                  <div className="user-card__details">
                    <UserEditPanel user={user} onSave={(updated) => {
                      setUsers((prev: UserItem[]) => prev.map((u: UserItem) => u.id === updated.id ? updated : u))
                      setSelectedUser(updated)
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Stores Management Tab
function StoresManagementTab() {
  const [stores, setStores] = useState<AdminStoreItem[]>([])
  const [aliases, setAliases] = useState<Array<{ id: string; primaryStore: { id: string; name: string }; aliasStore: { id: string; name: string } }>>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [categoryInput, setCategoryInput] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Link stores state
  const [primaryId, setPrimaryId] = useState('')
  const [aliasId, setAliasId] = useState('')
  const [linkSearch1, setLinkSearch1] = useState('')
  const [linkSearch2, setLinkSearch2] = useState('')

  const loadStores = useCallback(async () => {
    setLoading(true)
    try { setStores(await getAdminStores()) } catch {} finally { setLoading(false) }
  }, [])

  const loadAliases = useCallback(async () => {
    try {
      const { getStoreAliases } = await import('../services/api')
      setAliases(await getStoreAliases())
    } catch {}
  }, [])

  useEffect(() => { loadStores(); loadAliases() }, [loadStores, loadAliases])

  // Get unique categories and programs from stores
  const allCategories = [...new Set(stores.flatMap(s => s.categories))]
  const allPrograms = [...new Set(stores.flatMap(s => s.programs))]

  const filteredStores = stores.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterProgram && !s.programs.includes(filterProgram)) return false
    if (filterCategory && !s.categories.includes(filterCategory)) return false
    return true
  })
  const totalPages = Math.ceil(filteredStores.length / limit)
  const paginatedStores = filteredStores.slice((page - 1) * limit, page * limit)

  async function handleSaveCategory(storeId: string) {
    try {
      const cats = categoryInput.split(',').map(c => c.trim()).filter(Boolean)
      await updateStoreCategory(storeId, cats)
      setStores((prev) => prev.map((s) => s.id === storeId ? { ...s, categories: cats } : s))
      setEditingCategory(null)
      setMessage('Categorias atualizadas.')
      setTimeout(() => setMessage(''), 3000)
    } catch {}
  }

  async function handleLinkStores() {
    if (!primaryId || !aliasId) return
    try {
      const result = await mergeStores(primaryId, aliasId)
      setMessage(result.message)
      setPrimaryId(''); setAliasId('')
      setLinkSearch1(''); setLinkSearch2('')
      loadAliases()
      setTimeout(() => setMessage(''), 5000)
    } catch (err) {
      setMessage(err instanceof ApiResponseError ? err.message : 'Erro ao vincular.')
    }
  }

  async function handleRemoveAlias(id: string) {
    try {
      const { removeStoreAlias } = await import('../services/api')
      await removeStoreAlias(id)
      loadAliases()
      setMessage('Vínculo removido.')
      setTimeout(() => setMessage(''), 3000)
    } catch {}
  }

  const stores1 = linkSearch1 ? stores.filter((s) => s.name.toLowerCase().includes(linkSearch1.toLowerCase())) : []
  const stores2 = linkSearch2 ? stores.filter((s) => s.name.toLowerCase().includes(linkSearch2.toLowerCase())) : []

  return (
    <div className="admin-panel">
      {message && <div className="success-message">{message}</div>}

      {/* Seção 1: Categorias */}
      <div className="admin-panel__section">
        <h2>Categorias</h2>
        <p className="admin-description">Selecione uma categoria existente para cada loja.</p>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: '180px' }}>
            <input type="text" placeholder="Buscar loja..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem' }} />
          </div>
          <div style={{ minWidth: '140px' }}>
            <select value={filterProgram} onChange={(e) => { setFilterProgram(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem' }}>
              <option value="">Todos os programas</option>
              {allPrograms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '140px' }}>
            <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem' }}>
              <option value="">Todas as categorias</option>
              {allCategories.sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {loading ? <p className="admin-loading">Carregando...</p> : (
          <>
            <p className="stores-showing" style={{ marginBottom: '0.5rem' }}>
              Mostrando <strong>{paginatedStores.length}</strong> de <strong>{filteredStores.length}</strong> lojas
            </p>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th>Loja</th><th>Categoria</th><th>Programas</th></tr></thead>
                <tbody>
                  {paginatedStores.map((store) => (
                    <tr key={store.id}>
                      <td className="td-bold">{store.name}</td>
                      <td>
                        {editingCategory === store.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {allCategories.filter(c => c !== 'Outros').sort().map(c => {
                                const selected = categoryInput.split(',').map(s => s.trim()).includes(c)
                                return (
                                  <button key={c} onClick={() => {
                                    const current = categoryInput.split(',').map(s => s.trim()).filter(Boolean)
                                    if (selected) {
                                      setCategoryInput(current.filter(x => x !== c).join(', '))
                                    } else {
                                      setCategoryInput([...current, c].join(', '))
                                    }
                                  }} style={{
                                    padding: '0.2rem 0.4rem', fontSize: '0.625rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid',
                                    background: selected ? '#1a73e8' : '#fff', color: selected ? '#fff' : '#333', borderColor: selected ? '#1a73e8' : '#ccc'
                                  }}>{c}</button>
                                )
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button onClick={() => handleSaveCategory(store.id)} className="btn-save-url">Salvar</button>
                              <button onClick={() => setEditingCategory(null)} className="btn-cancel-url">✕</button>
                            </div>
                          </div>
                        ) : (
                          <span onClick={() => { setEditingCategory(store.id); setCategoryInput(store.categories.join(', ')) }}
                            style={{ cursor: 'pointer', borderBottom: '1px dashed #ccc' }} title="Clique para alterar">
                            {store.categories.length > 0 ? store.categories.join(', ') : '—'}
                          </span>
                        )}
                      </td>
                      <td>{store.programs.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <nav className="pagination" style={{ marginTop: '1rem' }}>
                <div className="pagination__controls">
                  <button className="pagination__button" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>← Anterior</button>
                  <span className="pagination__info">Página {page} de {totalPages}</span>
                  <button className="pagination__button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Próxima →</button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      {/* Seção 2: Vincular Lojas */}
      <div className="admin-panel__section">
        <h2>Vincular Lojas</h2>
        <p className="admin-description">
          Quando a mesma loja tem nomes diferentes em programas distintos, vincule-as aqui para exibir como uma só.
        </p>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {/* Lado 1 */}
          <div style={{ flex: 1, minWidth: '220px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#6b7280' }}>
              1. Programa
            </label>
            <select value={linkSearch1} onChange={(e) => { setLinkSearch1(e.target.value); setPrimaryId('') }}
              style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              <option value="">Selecione o programa</option>
              {allPrograms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {linkSearch1 && (
              <>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#6b7280' }}>
                  2. Loja
                </label>
                <select value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <option value="">Selecione a loja</option>
                  {stores.filter(s => s.programs.includes(linkSearch1)).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {primaryId && <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem' }}>✓ {stores.find(s => s.id === primaryId)?.name}</p>}
              </>
            )}
          </div>

          {/* Separador */}
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', color: '#9ca3af' }}>=</div>

          {/* Lado 2 */}
          <div style={{ flex: 1, minWidth: '220px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#6b7280' }}>
              1. Programa
            </label>
            <select value={linkSearch2} onChange={(e) => { setLinkSearch2(e.target.value); setAliasId('') }}
              style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              <option value="">Selecione o programa</option>
              {allPrograms.filter(p => p !== linkSearch1).map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {linkSearch2 && (
              <>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#6b7280' }}>
                  2. Loja
                </label>
                <select value={aliasId} onChange={(e) => setAliasId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <option value="">Selecione a loja</option>
                  {stores.filter(s => s.programs.includes(linkSearch2)).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {aliasId && <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem' }}>✓ {stores.find(s => s.id === aliasId)?.name}</p>}
              </>
            )}
          </div>
        </div>

        {primaryId && aliasId && (
          <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            <strong>{stores.find(s => s.id === primaryId)?.name}</strong> ({linkSearch1}) será vinculada com <strong>{stores.find(s => s.id === aliasId)?.name}</strong> ({linkSearch2})
          </div>
        )}

        <button onClick={handleLinkStores} disabled={!primaryId || !aliasId} className="btn-crawler" style={{ width: 'auto' }}>
          🔗 Confirmar Vínculo
        </button>

        {aliases.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Vínculos Existentes ({aliases.length})</h3>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th>Loja Principal</th><th>Loja Vinculada</th><th>Ação</th></tr></thead>
                <tbody>
                  {aliases.map((a) => (
                    <tr key={a.id}>
                      <td className="td-bold">{a.primaryStore.name}</td>
                      <td>{a.aliasStore.name}</td>
                      <td><button onClick={() => handleRemoveAlias(a.id)} className="btn-delete-user" title="Remover vínculo">🗑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Timer component that shows elapsed time since crawler started
function RunningTimer({ startTime }: { startTime?: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const update = () => {
      if (startTime) {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 600 }}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  )
}

// User Edit Panel
function UserEditPanel({ user, onSave }: { user: UserItem; onSave: (u: UserItem) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [email, setEmail] = useState(user.email)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const updated = await updateUser(user.id, { name, phone, email })
      onSave(updated)
      setEditing(false)
      setMsg('Salvo!')
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setMsg(err instanceof ApiResponseError ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <>
        <div className="user-card__detail-row"><span className="user-card__detail-label">E-mail</span><span className="user-card__detail-value">{user.email}</span></div>
        <div className="user-card__detail-row"><span className="user-card__detail-label">Nome</span><span className="user-card__detail-value">{user.name || 'Não informado'}</span></div>
        <div className="user-card__detail-row"><span className="user-card__detail-label">Telefone</span><span className="user-card__detail-value">{user.phone || 'Não informado'}</span></div>
        <div className="user-card__detail-row"><span className="user-card__detail-label">Role</span><span className="user-card__detail-value">{user.role}</span></div>
        <div className="user-card__detail-row"><span className="user-card__detail-label">Cadastrado em</span><span className="user-card__detail-value">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</span></div>
        <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="btn-crawler-small" style={{ marginTop: '0.75rem' }}>
          ✎ Editar
        </button>
        {msg && <span style={{ fontSize: '0.75rem', color: '#16a34a', marginLeft: '0.5rem' }}>{msg}</span>}
      </>
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280' }}>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', border: '1.5px solid #e5e7eb', borderRadius: '6px' }} />
      </div>
      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280' }}>Nome</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do usuário"
          style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', border: '1.5px solid #e5e7eb', borderRadius: '6px' }} />
      </div>
      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280' }}>Telefone</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone"
          style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', border: '1.5px solid #e5e7eb', borderRadius: '6px' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={handleSave} disabled={saving} className="btn-crawler-small">
          {saving ? '...' : '✓ Salvar'}
        </button>
        <button onClick={() => setEditing(false)} className="btn-cancel-url">Cancelar</button>
      </div>
      {msg && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>{msg}</span>}
    </div>
  )
}
