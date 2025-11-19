import { supabase } from '../utils/supabase'
import { deleteFromSupabaseByPath } from '../utils/fileUpload'

/**
 * Process storage cleanup queue - deletes files from Supabase Storage
 * that were queued for deletion when evidence was deleted
 * 
 * This should be called periodically (e.g., via cron job or scheduled task)
 */
export async function processStorageCleanupQueue(): Promise<{
    processed: number
    failed: number
    errors: string[]
}> {
    const errors: string[] = []
    let processed = 0
    let failed = 0

    try {
        // Get unprocessed cleanup queue items (limit to 100 at a time)
        const { data: queueItems, error: fetchError } = await supabase
            .from('storage_cleanup_queue')
            .select('id, file_path, bucket_name')
            .is('processed_at', null)
            .limit(100)

        if (fetchError) {
            throw new Error(`Failed to fetch cleanup queue: ${fetchError.message}`)
        }

        if (!queueItems || queueItems.length === 0) {
            return { processed: 0, failed: 0, errors: [] }
        }

        // Process each item
        for (const item of queueItems) {
            try {
                const success = await deleteFromSupabaseByPath(item.file_path)

                // Mark as processed
                const { error: updateError } = await supabase
                    .from('storage_cleanup_queue')
                    .update({
                        processed_at: new Date().toISOString(),
                        error_message: success ? null : 'Failed to delete file'
                    })
                    .eq('id', item.id)

                if (updateError) {
                    console.error(`Failed to update cleanup queue item ${item.id}:`, updateError)
                }

                if (success) {
                    processed++
                } else {
                    failed++
                    errors.push(`Failed to delete: ${item.file_path}`)
                }
            } catch (error) {
                failed++
                const errorMsg = error instanceof Error ? error.message : 'Unknown error'
                errors.push(`Error processing ${item.file_path}: ${errorMsg}`)

                // Mark as processed with error
                await supabase
                    .from('storage_cleanup_queue')
                    .update({
                        processed_at: new Date().toISOString(),
                        error_message: errorMsg
                    })
                    .eq('id', item.id)
            }
        }

        return { processed, failed, errors }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`Storage cleanup queue processing failed: ${errorMsg}`)
    }
}

