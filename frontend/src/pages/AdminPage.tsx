import { useState, useEffect, useCallback } from 'react'
import {
  getPrograms,
  createProgram,
  updateProgram,
  runCrawler,
  runCrawlerForProgram,
  getCrawlerSchedule,
  updateCrawlerSchedule,
  getCrawlerHistory,
  ApiResponseError,
  type ProgramItem,
  type CrawlerRunResponse,
  type CrawlLogItem,
} from '../services/api'

type Tab = 'crawler' | 'programs' | 'history'

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
  const [activeTab, setActiveTab] = useState<Tab>('crawler')
  const [programs, setPrograms] = useState<ProgramItem[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [crawlerRunning, setCrawlerRunning] = useState(false)
  const [crawlerRunningProgram, setCrawlerRunningProgram] = useState<string | null>(null)

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

  const addLog = (message: string, type: CrawlerLog['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR')
    setCrawlerLogs((prev) => [...prev, { timestamp, message, type }])
  }

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

  useEffect(() => { loadPrograms(); loadSchedule(); loadHistory() }, [loadPrograms, loadSchedule, loadHistory])
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
          <button className={`admin-tab ${activeTab === 'crawler' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('crawler')}>
            🔄 Crawler
          </button>
          <button className={`admin-tab ${activeTab === 'programs' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('programs')}>
            🏷️ Programas
          </button>
          <button className={`admin-tab ${activeTab === 'history' ? 'admin-tab--active' : ''}`} onClick={() => setActiveTab('history')}>
            📋 Histórico
          </button>
        </div>

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
                <button onClick={handleRunCrawler} disabled={crawlerRunning || !!crawlerRunningProgram} className="btn-crawler">
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
                            <span className="crawler-program-name">{program.name}</span>
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
                            disabled={crawlerRunning || crawlerRunningProgram === program.id}
                            className="btn-crawler-small"
                            title={`Executar crawler para ${program.name}`}
                          >
                            {crawlerRunningProgram === program.id ? '...' : '▶ Executar'}
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
              {crawlerLogs.length > 0 && (
                <div className="crawler-logs">
                  <div className="crawler-logs__container">
                    {crawlerLogs.map((log, idx) => (
                      <div key={idx} className={`crawler-log crawler-log--${log.type}`}>
                        <span className="crawler-log__time">{log.timestamp}</span>
                        <span className="crawler-log__msg">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                          <span className="program-card__name">{p.name}</span>
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
              {historyLoading ? <p className="admin-loading">Carregando...</p> : history.length === 0 ? <p className="admin-empty">Nenhuma execução.</p> : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Data/Hora</th><th>Programa</th><th>Status</th><th>Lojas</th><th>Duração</th><th>Erro</th></tr>
                    </thead>
                    <tbody>
                      {history.map((log) => {
                        const duration = Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)
                        return (
                          <tr key={log.id}>
                            <td>{new Date(log.completedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                            <td className="td-bold">{log.programName}</td>
                            <td><span className={`badge ${log.status === 'success' ? 'badge--active' : 'badge--error'}`}>{log.status === 'success' ? '✓' : '✗'}</span></td>
                            <td>{log.storesFound}</td>
                            <td>{duration}s</td>
                            <td>{log.errorMessage || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
