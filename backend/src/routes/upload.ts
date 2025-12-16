import { Router, Response } from 'express'
import { upload, uploadToSupabase } from '../utils/fileUpload'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { StorageService } from '../services/storageService'
import { compressImage, isCompressibleImage } from '../utils/imageCompression'

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

        // Phase 1: No limit checks - just upload
        // TODO Phase 2: Check storage limit before upload
        // const canUpload = await StorageService.checkStorageLimit(req.user.id, req.file.size)
        // if (!canUpload) {
        //     res.status(413).json({ error: 'Storage limit exceeded', code: 'STORAGE_LIMIT_EXCEEDED' })
        //     return
        // }

        // Compress images before upload (invisible to user)
        // Only affects image/* MIME types, PDFs/videos/docs pass through unchanged
        let finalBuffer = req.file.buffer
        let finalMimetype = req.file.mimetype
        let finalSize = req.file.size

        if (isCompressibleImage(req.file.mimetype)) {
            const compressionResult = await compressImage(
                req.file.buffer,
                req.file.mimetype,
                req.file.size
            )
            finalBuffer = compressionResult.buffer
            finalMimetype = compressionResult.mimetype
            finalSize = compressionResult.size
            
            // Update file object for uploadToSupabase
            req.file.buffer = finalBuffer
            req.file.mimetype = finalMimetype
            req.file.size = finalSize
        }

        // Upload to Supabase Storage (uses potentially compressed buffer)
        const fileUrl = await uploadToSupabase(req.file, req.user.id)

        // Track storage usage using FINAL size (compressed if applicable)
        const organizationId = await StorageService.getOrganizationIdForUser(req.user.id)
        if (organizationId) {
            await StorageService.incrementStorage(organizationId, finalSize)
        }

        res.json({
            success: true,
            file_url: fileUrl,
            filename: req.file.originalname,
            originalname: req.file.originalname,
            size: finalSize, // Return compressed size
            mimetype: finalMimetype
        })
    } catch (error) {
        console.error('File upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'File upload failed'
        res.status(500).json({ error: errorMessage })
    }
})

export default router 