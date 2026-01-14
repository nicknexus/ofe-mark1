import multer from 'multer'
import { supabase } from './supabase'
import path from 'path'

// File filter for security
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allow images, documents, and common file types
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        'video/mp4', 'video/mpeg', 'video/quicktime'
    ]

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error('Invalid file type'))
    }
}

// Use memory storage since we'll upload directly to Supabase
export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
    }
})

/**
 * Upload file to Supabase Storage and return public URL
 * @param file - Multer file object (from memory storage)
 * @param userId - User ID for organizing files
 * @returns Public URL of uploaded file
 */
export const uploadToSupabase = async (
    file: Express.Multer.File,
    userId: string
): Promise<string> => {
    // Generate unique filename: timestamp-randomId-originalname
    const timestamp = Date.now()
    const randomId = Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${timestamp}-${randomId}-${baseName}${ext}`
    
    // File path in Supabase Storage: evidence/{userId}/{filename}
    const filePath = `evidence/${userId}/${filename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('evidence-files')
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false // Don't overwrite existing files
        })

    if (error) {
        console.error('Supabase upload error:', error)
        throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('evidence-files')
        .getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
        throw new Error('Failed to generate file URL')
    }

    return urlData.publicUrl
}

/**
 * Delete file from Supabase Storage
 * @param fileUrl - Full URL of the file to delete
 * @returns void
 */
export const deleteFromSupabase = async (fileUrl: string): Promise<void> => {
    try {
        // Extract file path from URL
        // URL format: https://{project}.supabase.co/storage/v1/object/public/evidence-files/evidence/{userId}/{filename}
        const urlParts = fileUrl.split('/evidence-files/')
        if (urlParts.length !== 2) {
            console.warn('Invalid file URL format:', fileUrl)
            return
        }

        const filePath = urlParts[1]

        const { error } = await supabase.storage
            .from('evidence-files')
            .remove([filePath])

        if (error) {
            console.error('Failed to delete file from Supabase:', error)
            // Don't throw - file deletion failure shouldn't break evidence deletion
        }
    } catch (error) {
        console.error('Error deleting file from Supabase:', error)
        // Don't throw - file deletion failure shouldn't break evidence deletion
    }
}

/**
 * Delete file from Supabase Storage by file path (for cleanup queue processing)
 * @param filePath - Path relative to bucket root (e.g., "evidence/{userId}/{filename}")
 * @returns boolean - true if successful, false otherwise
 */
export const deleteFromSupabaseByPath = async (filePath: string): Promise<boolean> => {
    try {
        const { error } = await supabase.storage
            .from('evidence-files')
            .remove([filePath])

        if (error) {
            console.error(`Failed to delete file ${filePath} from Supabase:`, error)
            return false
        }
        return true
    } catch (error) {
        console.error(`Error deleting file ${filePath} from Supabase:`, error)
        return false
    }
}

/**
 * Generate file URL (kept for backward compatibility, but now returns Supabase URL)
 * @deprecated Use uploadToSupabase instead
 */
export const generateFileUrl = (filename: string): string => {
    // This is deprecated - files should be uploaded via uploadToSupabase
    // Keeping for backward compatibility but shouldn't be used
    return `/uploads/${filename}`
} 