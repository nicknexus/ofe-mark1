import { Router, Response } from 'express'
import { upload, uploadToSupabase } from '../utils/fileUpload'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { StorageService } from '../services/storageService'
import { compressImage, isCompressibleImage } from '../utils/imageCompression'
import { supabase } from '../utils/supabase'
import path from 'path'

const router = Router()

// Generate signed URL for direct upload to Supabase (bypasses Vercel size limits)
router.post('/signed-url', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'User not authenticated' })
            return
        }

        const { filename, contentType } = req.body
        if (!filename || !contentType) {
            res.status(400).json({ error: 'filename and contentType are required' })
            return
        }

        // Generate unique filename
        const timestamp = Date.now()
        const randomId = Math.round(Math.random() * 1E9)
        const ext = path.extname(filename)
        const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9]/g, '_')
        const uniqueFilename = `${timestamp}-${randomId}-${baseName}${ext}`
        const filePath = `evidence/${req.user.id}/${uniqueFilename}`

        // Create signed upload URL (valid for 2 minutes)
        const { data, error } = await supabase.storage
            .from('evidence-files')
            .createSignedUploadUrl(filePath)

        if (error) {
            console.error('Failed to create signed URL:', error)
            res.status(500).json({ error: 'Failed to create upload URL' })
            return
        }

        // Get the public URL that the file will have after upload
        const { data: urlData } = supabase.storage
            .from('evidence-files')
            .getPublicUrl(filePath)

        res.json({
            signedUrl: data.signedUrl,
            token: data.token,
            filePath,
            publicUrl: urlData.publicUrl
        })
    } catch (error) {
        console.error('Signed URL error:', error)
        res.status(500).json({ error: 'Failed to generate upload URL' })
    }
})

// Confirm upload completed and track storage
router.post('/confirm', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'User not authenticated' })
            return
        }

        const { filePath, fileSize } = req.body
        if (!filePath || !fileSize) {
            res.status(400).json({ error: 'filePath and fileSize are required' })
            return
        }

        // Track storage usage
        const organizationId = await StorageService.getOrganizationIdForUser(req.user.id)
        if (organizationId) {
            await StorageService.incrementStorage(organizationId, fileSize)
        }

        console.log(`[Upload] ✅ Direct upload confirmed: ${filePath} (${fileSize} bytes)`)

        res.json({ success: true })
    } catch (error) {
        console.error('Confirm upload error:', error)
        res.status(500).json({ error: 'Failed to confirm upload' })
    }
})

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
        const originalSize = req.file.size
        const originalMimetype = req.file.mimetype
        let finalBuffer = req.file.buffer
        let finalMimetype = req.file.mimetype
        let finalSize = req.file.size
        let wasCompressed = false

        console.log(`[Upload] Received file: ${req.file.originalname} (${originalMimetype}, ${originalSize} bytes)`)

        if (isCompressibleImage(req.file.mimetype)) {
            console.log(`[Upload] File is compressible image, attempting compression...`)
            const compressionResult = await compressImage(
                req.file.buffer,
                req.file.mimetype,
                req.file.size
            )
            finalBuffer = compressionResult.buffer
            finalMimetype = compressionResult.mimetype
            finalSize = compressionResult.size
            wasCompressed = compressionResult.wasCompressed
            
            if (wasCompressed) {
                const savings = Math.round((1 - finalSize / originalSize) * 100)
                console.log(`[Upload] ✅ Compressed: ${originalSize} → ${finalSize} bytes (${savings}% reduction)`)
            } else {
                console.log(`[Upload] ⚠️ Not compressed (sharp unavailable or compression not beneficial)`)
            }
            
            // Update file object for uploadToSupabase
            req.file.buffer = finalBuffer
            req.file.mimetype = finalMimetype
            req.file.size = finalSize
        } else {
            console.log(`[Upload] Non-image file, skipping compression`)
        }

        // Upload to Supabase Storage (uses potentially compressed buffer)
        console.log(`[Upload] Uploading to Supabase...`)
        const fileUrl = await uploadToSupabase(req.file, req.user.id)
        console.log(`[Upload] ✅ Uploaded successfully: ${fileUrl}`)

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
            mimetype: finalMimetype,
            // Compression info for debugging
            compression: {
                wasCompressed,
                originalSize,
                finalSize,
                savings: wasCompressed ? Math.round((1 - finalSize / originalSize) * 100) : 0
            }
        })
    } catch (error) {
        console.error('File upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'File upload failed'
        res.status(500).json({ error: errorMessage })
    }
})

export default router 