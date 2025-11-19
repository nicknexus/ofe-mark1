import { Router, Response } from 'express'
import { upload, uploadToSupabase } from '../utils/fileUpload'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

// File upload endpoint
router.post('/file', authenticateUser, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' })
            return
        }

        if (!req.user?.id) {
            res.status(401).json({ error: 'User not authenticated' })
            return
        }

        // Upload to Supabase Storage
        const fileUrl = await uploadToSupabase(req.file, req.user.id)

        res.json({
            success: true,
            file_url: fileUrl,
            filename: req.file.originalname,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        })
    } catch (error) {
        console.error('File upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'File upload failed'
        res.status(500).json({ error: errorMessage })
    }
})

export default router 