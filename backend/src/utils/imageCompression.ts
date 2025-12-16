import sharp from 'sharp';

/**
 * IMAGE COMPRESSION UTILITY
 * 
 * Compresses images before upload to reduce storage costs.
 * Only processes image/* MIME types.
 * Non-images pass through unchanged.
 * 
 * Compression rules:
 * - Max width: 2000px (maintains aspect ratio, no upscale)
 * - JPEG quality: 75
 * - PNG with transparency → PNG (compressed)
 * - PNG without transparency → JPEG
 * - Preserves EXIF orientation
 */

// Compression settings
const MAX_WIDTH = 2000;
const JPEG_QUALITY = 75;
const MIN_SIZE_FOR_COMPRESSION = 200 * 1024; // 200KB - skip tiny images

// Supported image MIME types
const COMPRESSIBLE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
];

export interface CompressionResult {
    buffer: Buffer;
    mimetype: string;
    size: number;
    wasCompressed: boolean;
}

/**
 * Check if a MIME type is a compressible image
 */
export function isCompressibleImage(mimetype: string): boolean {
    return COMPRESSIBLE_MIME_TYPES.includes(mimetype.toLowerCase());
}

/**
 * Compress an image buffer
 * 
 * @param buffer - Original file buffer
 * @param mimetype - Original MIME type
 * @param originalSize - Original file size in bytes
 * @returns Compressed result with buffer, mimetype, and size
 */
export async function compressImage(
    buffer: Buffer,
    mimetype: string,
    originalSize: number
): Promise<CompressionResult> {
    // Return unchanged if not a compressible image
    if (!isCompressibleImage(mimetype)) {
        return {
            buffer,
            mimetype,
            size: originalSize,
            wasCompressed: false,
        };
    }

    // Skip compression for very small images
    if (originalSize < MIN_SIZE_FOR_COMPRESSION) {
        return {
            buffer,
            mimetype,
            size: originalSize,
            wasCompressed: false,
        };
    }

    try {
        // Load image with sharp
        let image = sharp(buffer, { failOnError: false });
        
        // Get metadata to check dimensions and if PNG has alpha
        const metadata = await image.metadata();
        
        // Auto-rotate based on EXIF orientation
        image = image.rotate();

        // Resize if wider than MAX_WIDTH (maintain aspect ratio, no upscale)
        if (metadata.width && metadata.width > MAX_WIDTH) {
            image = image.resize(MAX_WIDTH, null, {
                withoutEnlargement: true,
                fit: 'inside',
            });
        }

        let compressedBuffer: Buffer;
        let finalMimetype: string;

        // Determine output format
        if (mimetype === 'image/png' && metadata.hasAlpha) {
            // PNG with transparency - keep as PNG but compress
            compressedBuffer = await image
                .png({ compressionLevel: 9, quality: JPEG_QUALITY })
                .toBuffer();
            finalMimetype = 'image/png';
        } else if (mimetype === 'image/webp') {
            // WebP - keep as WebP
            compressedBuffer = await image
                .webp({ quality: JPEG_QUALITY })
                .toBuffer();
            finalMimetype = 'image/webp';
        } else {
            // Everything else (JPEG, PNG without alpha) → JPEG
            compressedBuffer = await image
                .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
                .toBuffer();
            finalMimetype = 'image/jpeg';
        }

        const compressedSize = compressedBuffer.length;

        // Safety: If compressed is larger than original, use original
        if (compressedSize >= originalSize) {
            console.log(`[ImageCompression] Compressed size (${compressedSize}) >= original (${originalSize}), using original`);
            return {
                buffer,
                mimetype,
                size: originalSize,
                wasCompressed: false,
            };
        }

        const savings = Math.round((1 - compressedSize / originalSize) * 100);
        console.log(`[ImageCompression] Compressed ${mimetype} from ${originalSize} to ${compressedSize} bytes (${savings}% reduction)`);

        return {
            buffer: compressedBuffer,
            mimetype: finalMimetype,
            size: compressedSize,
            wasCompressed: true,
        };
    } catch (error) {
        // Compression failed - log and return original
        console.error('[ImageCompression] Compression failed, using original:', error);
        return {
            buffer,
            mimetype,
            size: originalSize,
            wasCompressed: false,
        };
    }
}

