import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createRateLimiter } from './middleware/rateLimiter.js'
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.routes.js'
import adminRoutes from './routes/admin.routes.js'
import storesRoutes from './routes/stores.routes.js'

const app = express()

// Security and parsing middleware
app.use(cors())
app.use(helmet())
app.use(express.json())
app.use(createRateLimiter({ windowMs: 60_000, maxRequests: 200 }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/', storesRoutes)

// Global error handler (must be last)
app.use(errorHandler)

export default app
