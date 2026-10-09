import steamLogoWhite from './logos/steam-logo-white.svg?raw'
import steamLogoBlack from './logos/steam-logo-black.svg?raw'
import steamSymbolWhite from './logos/steam-symbol-white.svg?raw'
import steamSymbolBlack from './logos/steam-symbol-black.svg?raw'
import type { Asset } from '../domain/types'

type SharedLogo = {
  id: string
  label: string
  svg: string
  preview: string
  asset: Asset
  tone: 'white' | 'black'
  kind: 'logo' | 'symbol'
}

function logo(kind: SharedLogo['kind'], tone: SharedLogo['tone'], svg: string): SharedLogo {
  const id = `builtin:steam-${kind}-${tone}:1`
  const label = `Steam ${kind === 'logo' ? 'logo' : 'symbol'} · ${tone}`
  return { id, label, svg, tone, kind, preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    asset: { id, name: `${label}.svg`, mimeType: 'image/svg+xml', blob: new Blob([svg], { type: 'image/svg+xml' }), width: kind === 'logo' ? 294 : 90, height: 90 } }
}

// Versioned, immutable assets bundled with the app: no runtime network requests.
export const sharedLogos: SharedLogo[] = [
  logo('logo', 'white', steamLogoWhite), logo('logo', 'black', steamLogoBlack),
  logo('symbol', 'white', steamSymbolWhite), logo('symbol', 'black', steamSymbolBlack),
]
export const builtinAssets: Record<string, Asset> = Object.fromEntries(sharedLogos.map((entry) => [entry.id, entry.asset]))

export function builtinAsset(id: string): Asset | undefined { return Object.hasOwn(builtinAssets, id) ? builtinAssets[id] : undefined }

// Recognize bundled SVGs to verify their reserved built-in identities.
export function bundledSvg(svg: string): SharedLogo | undefined { return sharedLogos.find((entry) => entry.svg === svg) }

export function steamLogoFor(background: string): string {
  const channels = background.slice(1).match(/.{2}/g)!.map((hex) => {
    const value = parseInt(hex, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return `builtin:steam-logo-${luminance > 0.179 ? 'black' : 'white'}:1`
}
