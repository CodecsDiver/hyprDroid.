export function downloadTextFile(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/x-python;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const MAX_IMPORT_BYTES = 256 * 1024

/** Opens the system file picker. Resolves null when the user cancels. Must be called from a user gesture. */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('cancel', () => resolve(null))
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      if (file.size > MAX_IMPORT_BYTES) return reject(new Error(`${file.name} is larger than ${MAX_IMPORT_BYTES / 1024} KB`))
      resolve({ name: file.name, text: await file.text() })
    })
    input.click()
  })
}
