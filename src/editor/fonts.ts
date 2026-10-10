export type FontCategory = 'Serif' | 'Sans serif' | 'Display' | 'Monospace'
export const fontCatalog: { family: string; category: FontCategory; remote: boolean }[] = [
  ...(['Georgia', 'Times New Roman'].map(family => ({ family, category: 'Serif' as const, remote: false }))),
  ...(['Arial', 'Verdana'].map(family => ({ family, category: 'Sans serif' as const, remote: false }))),
  { family: 'Courier New', category: 'Monospace', remote: false },
  ...(['Merriweather', 'Lora', 'Libre Baskerville', 'Playfair Display', 'Source Serif 4', 'Crimson Pro'].map(family => ({ family, category: 'Serif' as const, remote: true }))),
  ...(['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito Sans', 'Source Sans 3'].map(family => ({ family, category: 'Sans serif' as const, remote: true }))),
  ...(['Oswald', 'Bebas Neue', 'Anton', 'Barlow Condensed'].map(family => ({ family, category: 'Display' as const, remote: true }))),
  ...(['Roboto Mono', 'Source Code Pro', 'Space Mono'].map(family => ({ family, category: 'Monospace' as const, remote: true }))),
]
const requests = new Map<string, Promise<void>>()

export function loadFont(family: string): Promise<void> {
  if (!fontCatalog.some(font => font.family === family && font.remote) || typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  const existing = requests.get(family)
  if (existing) return existing
  const request = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    const weights = ['Bebas Neue', 'Anton'].includes(family) ? '400' : '400;700'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights}&display=swap`
    const timeout = window.setTimeout(() => fail(), 15000)
    function fail() {
      window.clearTimeout(timeout)
      link.remove()
      reject(new Error(`Unable to load ${family}. Check your connection and try again.`))
    }
    link.onerror = fail
    link.onload = () => {
      void Promise.all([document.fonts.load(`400 16px "${family}"`), document.fonts.load(`700 16px "${family}"`)]).then(results => {
        if (!results[0].length) { fail(); return }
        window.clearTimeout(timeout)
        resolve()
      }, fail)
    }
    document.head.append(link)
  })
  requests.set(family, request)
  void request.catch(() => { requests.delete(family) })
  return request
}
