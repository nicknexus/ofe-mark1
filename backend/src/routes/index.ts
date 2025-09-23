import { Router } from 'express'
import beneficiaryRoutes from './beneficiaries'

const router = Router()

router.use('/beneficiaries', beneficiaryRoutes)

export default router


