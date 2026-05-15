import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { AdminController } from '../controllers/admin.controller.js'

const router = Router()

// All admin routes require authentication + admin role
router.use(authenticate)
router.use(requireRole('admin'))

router.post('/users', AdminController.createUser)
router.get('/users', AdminController.listUsers)
router.patch('/users/:userId/toggle-status', AdminController.toggleUserStatus)
router.delete('/users/:userId', AdminController.deleteUser)
router.get('/programs', AdminController.listPrograms)
router.post('/programs', AdminController.createProgram)
router.patch('/programs/:programId', AdminController.updateProgram)
router.post('/crawler/run', AdminController.runCrawler)
router.post('/crawler/run/:programId', AdminController.runCrawlerForProgram)
router.get('/crawler/schedule', AdminController.getCrawlerSchedule)
router.put('/crawler/schedule', AdminController.updateCrawlerSchedule)
router.get('/crawler/history', AdminController.getCrawlerHistory)

export default router
