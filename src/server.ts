import 'dotenv/config'
import app from './app.js'
import { startScheduler } from './config/scheduler.js'
import { runCrawler } from './crawler/index.js'

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`)
  startScheduler().catch((err) => {
    console.error('[Server] Scheduler error:', err instanceof Error ? err.message : err)
  })

  // Run crawler on first startup to populate stores/scores
  console.log('[Server] Running initial crawler on startup...')
  runCrawler()
    .then((results) => {
      const success = results.filter((r) => r.status === 'success').length
      const total = results.reduce((sum, r) => sum + r.storesFound, 0)
      console.log(`[Server] Initial crawl complete — ${success} programs, ${total} stores`)
    })
    .catch((err) => {
      console.error('[Server] Initial crawl failed:', err instanceof Error ? err.message : err)
    })
})
