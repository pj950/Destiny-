import fs from 'fs'
import path from 'path'

export interface LampConfig {
  key: string
  name: string
  image: string
  price: number
  description?: string
}

const HEADER_IMAGE_FILENAME = '祈福点灯.png'
const IMAGE_EXTENSION = '.png'
const LAMP_PRICE = 19.9

const FALLBACK_DEFINITIONS: Array<{ name: string; fallbackImage: string; description?: string }> = [
  {
    name: '福运灯',
    fallbackImage: '/images/p1.jpg',
    description: '祈愿福泽绵延，守护家庭顺遂与喜乐。'
  },
  {
    name: '安康灯',
    fallbackImage: '/images/p2.jpg',
    description: '点亮身心安泰之光，为爱的人带来平安守护。'
  },
  {
    name: '财源灯',
    fallbackImage: '/images/p3.jpg',
    description: '招聚金气财富，助事业与财运蒸蒸日上。'
  },
  {
    name: '事业灯',
    fallbackImage: '/images/p4.jpg',
    description: '赐予勇气与灵感，护佑事业突破新境界。'
  }
]

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

function getImagePath(filename: string): string {
  return `/images/${filename}`
}

function localeSort(a: string, b: string) {
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true })
}

function ensureImagesDirectory(): string | null {
  const imagesDir = path.join(process.cwd(), 'public', 'images')
  if (!fs.existsSync(imagesDir)) {
    return null
  }
  return imagesDir
}

function resolveFallbackImage(imagesDir: string | null, name: string, fallbackImage: string): string {
  if (!imagesDir) {
    return fallbackImage
  }

  const pngCandidate = path.join(imagesDir, `${name}${IMAGE_EXTENSION}`)
  if (fs.existsSync(pngCandidate)) {
    return getImagePath(`${name}${IMAGE_EXTENSION}`)
  }

  const svgCandidate = path.join(imagesDir, `${name}.svg`)
  if (fs.existsSync(svgCandidate)) {
    return getImagePath(`${name}.svg`)
  }

  return fallbackImage
}

export const defaultLamps: LampConfig[] = (() => {
  const imagesDir = ensureImagesDirectory()

  return FALLBACK_DEFINITIONS.map((definition, index) => ({
    key: `lamp_${index + 1}`,
    name: definition.name,
    image: resolveFallbackImage(imagesDir, definition.name, definition.fallbackImage),
    price: LAMP_PRICE,
    description: definition.description
  }))
})()

function discoverLampImages(): string[] {
  const imagesDir = ensureImagesDirectory()
  if (!imagesDir) {
    return []
  }

  const files = fs.readdirSync(imagesDir)

  return files
    .filter((file) => {
      const lower = file.toLowerCase()
      if (!lower.endsWith(IMAGE_EXTENSION)) return false
      if (lower === HEADER_IMAGE_FILENAME.toLowerCase()) return false
      // Ensure file name contains at least one Chinese character to avoid non-lamp assets
      return /[\u4e00-\u9fa5]/.test(stripExtension(file))
    })
    .sort(localeSort)
}

export function getLampsConfig(): LampConfig[] {
  try {
    const lampImages = discoverLampImages()

    if (lampImages.length === 0) {
      return defaultLamps
    }

    return lampImages.map((file, index) => ({
      key: `lamp_${index + 1}`,
      name: stripExtension(file),
      image: getImagePath(file),
      price: LAMP_PRICE
    }))
  } catch (error) {
    console.error('[LampsConfig] Failed to scan lamp images:', error)
    return defaultLamps
  }
}
