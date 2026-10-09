import qrcode from 'qrcode-generator'

export function qrMatrix(value: string): boolean[][] | null {
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || value.length > 2000) return null
    const qr = qrcode(0, 'M')
    qr.addData(url.href)
    qr.make()
    return Array.from({ length: qr.getModuleCount() }, (_, row) =>
      Array.from({ length: qr.getModuleCount() }, (_, column) => qr.isDark(row, column)))
  } catch {
    return null
  }
}
