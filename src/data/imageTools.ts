/**
 * Re-encodes an image to a bounded size. Drawing to a canvas also drops all
 * EXIF metadata (GPS position, device, timestamps) before a photo is uploaded.
 */
export async function downscaleImage(file: Blob, maxEdge: number, quality = 0.86): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob && blob.type === 'image/webp') return blob
    const fallback = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!fallback) throw new Error('Could not encode the image')
    return fallback
  } finally {
    bitmap.close()
  }
}
