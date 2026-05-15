import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { StoresController } from '../controllers/stores.controller.js'

const router = Router()

router.get('/api/stores', authenticate, StoresController.listStores)
router.get('/api/stores/categories', authenticate, StoresController.listCategories)
router.get('/api/stores/programs', authenticate, StoresController.listPrograms)
router.get('/api/stores/:id', authenticate, StoresController.getStoreDetails)

export default router
