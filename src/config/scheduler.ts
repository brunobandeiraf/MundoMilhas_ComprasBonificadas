import cron, { type ScheduledTask } from 'node-cron'
import { env } from './env.js'
import { db } from './database.js'
import { runCrawler } from '../crawler/index.js'

let currentTask: ScheduledTask | null = null
let currentSchedule: string = ''

/**
 * Gets the crawler schedule from the database or falls back to env.
 */
async function getCrawlerSchedule(): Promise<string> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: 'crawler_schedule' },
    })
    return config?.value || env.CRON_SCHEDULE
  } catch {
    return env.CRON_SCHEDULE
  }
}

/**
 * Starts or restarts the cron scheduler with the given schedule.
 */
export async function startScheduler(): Promise<void> {
  const schedule = await getCrawlerSchedule()

  if (currentTask && currentSchedule === schedule) {
    return // Already running with same schedule
  }

  if (currentTask) {
    currentTask.stop()
    currentTask = null
  }

  currentSchedule = schedule
  console.log(`[Scheduler] Agendado: "${schedule}" (America/Sao_Paulo)`)

  currentTask = cron.schedule(schedule, async () => {
    console.log(`[Scheduler] Executando às ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
    try {
      await runCrawler()
    } catch (error) {
      console.error('[Scheduler] Erro:', error instanceof Error ? error.message : error)
    }
  }, {
    timezone: 'America/Sao_Paulo',
  })
}

/**
 * Updates the crawler schedule in the database and restarts the scheduler.
 */
export async function updateSchedule(newSchedule: string): Promise<void> {
  if (!cron.validate(newSchedule)) {
    throw new Error(`Expressão cron inválida: "${newSchedule}"`)
  }

  await db.systemConfig.upsert({
    where: { key: 'crawler_schedule' },
    create: { key: 'crawler_schedule', value: newSchedule },
    update: { value: newSchedule },
  })

  await startScheduler()
}

/**
 * Returns the current schedule.
 */
export async function getCurrentSchedule(): Promise<string> {
  return getCrawlerSchedule()
}
