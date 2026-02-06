/**
 * Compresses an image file to stay under a target size while maintaining quality
 * @param file - The image file to compress
 * @param maxSizeBytes - Maximum file size in bytes (default: 3MB)
 * @param maxQuality - Starting quality (default: 0.9)
 * @returns Promise<string> - Base64 encoded data URL
 */
export async function compressImage(
    file: File,
    maxSizeBytes: number = 3 * 1024 * 1024,
    maxQuality: number = 0.9
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                ctx.drawImage(img, 0, 0);

                // Try different quality levels to get under target size
                let quality = maxQuality;
                let blob: Blob | null = null;

                while (quality > 0.1) {
                    blob = await new Promise<Blob | null>((res) => {
                        canvas.toBlob(res, "image/jpeg", quality);
                    });

                    if (!blob) {
                        reject(new Error("Failed to create blob"));
                        return;
                    }

                    // If size is acceptable or we've tried lowest quality, use it
                    if (blob.size <= maxSizeBytes || quality <= 0.1) {
                        break;
                    }

                    // Reduce quality and try again
                    quality -= 0.1;
                }

                if (!blob) {
                    reject(new Error("Failed to compress image"));
                    return;
                }

                // Convert blob to base64
                const blobReader = new FileReader();
                blobReader.onload = () => {
                    resolve(blobReader.result as string);
                };
                blobReader.onerror = reject;
                blobReader.readAsDataURL(blob);
            };

            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

/**
 * Get file size from base64 data URL
 */
export function getBase64Size(dataUrl: string): number {
    const base64 = dataUrl.split(",")[1];
    return Math.ceil(base64.length * 0.75); // Approximate size in bytes
}
