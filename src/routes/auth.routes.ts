import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Public routes
router.post('/login', AuthController.login)
router.post('/activate/initiate', AuthController.initiateActivation)
router.post('/activate/confirm', AuthController.confirmActivation)
router.post('/activate/resend', AuthController.resendToken)

// Protected routes
router.post('/logout', authenticate, AuthController.logout)

export default router
