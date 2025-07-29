import { Router, Request, Response } from 'express'
import { upload, generateFileUrl } from '../utils/fileUpload'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// File upload endpoint
router.post('/file', authenticateUser, upload.single('file'), (req: AuthenticatedRequest, res: Response): void => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' })
            return
        }

        const fileUrl = generateFileUrl(req.file.filename)

        res.json({
            success: true,
            file_url: fileUrl,
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        })
    } catch (error) {
        console.error('File upload error:', error)
        res.status(500).json({ error: 'File upload failed' })
    }
})

export default router 