import fs from 'fs'
import path from 'path'

interface Lamp {
  key: string
  name: string
  image: string
  price: number
  description?: string
}

// Default fallback lanterns when no Chinese images are found
const DEFAULT_LAMPS: Lamp[] = [
  {
    key: 'p1',
    name: '福运灯',
    image: '/images/p1.jpg',
    price: 19.9,
    description: '祈愿福泽绵延，守护家庭顺遂与喜乐。'
  },
  {
    key: 'p2',
    name: '安康灯',
    image: '/images/p2.jpg',
    price: 19.9,
    description: '点亮身心安泰之光，为爱的人带来平安守护。'
  },
  {
    key: 'p3',
    name: '财源灯',
    image: '/images/p3.jpg',
    price: 19.9,
    description: '招聚金气财富，助事业与财运蒸蒸日上。'
  },
  {
    key: 'p4',
    name: '事业灯',
    image: '/images/p4.jpg',
    price: 19.9,
    description: '赐予勇气与灵感，护佑事业突破新境界。'
  },
]

// Lantern descriptions based on common blessing themes
const LAMP_DESCRIPTIONS: Record<string, string> = {
  '平安灯': '祈求平安健康，守护身心安宁，远离灾祸困扰。',
  '财运灯': '招财进宝，财运亨通，事业蒸蒸日上，财富滚滚来。',
  '健康灯': '祈愿身体康健，精力充沛，远离疾病困扰。',
  '爱情灯': '祈求姻缘美满，爱情甜蜜，找到心仪的另一半。',
  '事业灯': '助力事业有成，前程似锦，工作顺利步步高。',
  '学业灯': '祈求学业进步，金榜题名，智慧增长才华展。',
  '家庭灯': '守护家庭和睦，亲人安康，家庭幸福美满。',
  '智慧灯': '开启智慧之门，头脑清晰，决策明智事业兴。',
  '福气灯': '汇聚福气好运，吉祥如意，万事顺心遂人意。',
  '长寿灯': '祈愿长命百岁，健康长寿，福寿双全乐安康。'
}

// Function to extract lamp name from filename (remove .png or .svg extension)
function getLampNameFromFilename(filename: string): string {
  return filename.replace(/\.(png|svg)$/, '')
}

// Function to generate lamp key from name
function generateLampKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
}

// Function to get description for lamp name
function getLampDescription(name: string): string {
  return LAMP_DESCRIPTIONS[name] || `点燃${name}，为您带来美好的祝福与守护。`
}

// Server-side function to scan for Chinese lantern images
export async function getLampsConfig(): Promise<Lamp[]> {
  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images')
    
    // Check if images directory exists
    if (!fs.existsSync(imagesDir)) {
      console.warn('Images directory not found, using default lamps')
      return DEFAULT_LAMPS
    }

    // Read all files in images directory
    const files = fs.readdirSync(imagesDir)
    
    // Filter for Chinese lantern images (containing Chinese characters and ending with .png or .svg)
    const chineseLampFiles = files.filter(file => 
      (file.endsWith('.png') || file.endsWith('.svg')) && 
      /[\u4e00-\u9fa5]/.test(file) && // Contains Chinese characters
      file !== '祈福点灯.png' && file !== '祈福点灯.svg' // Exclude header image
    )

    // If no Chinese lantern images found, return default lamps
    if (chineseLampFiles.length === 0) {
      console.log('No Chinese lantern images found, using default lamps')
      return DEFAULT_LAMPS
    }

    // Generate lamp configurations from Chinese image files
    const chineseLamps: Lamp[] = chineseLampFiles.map(file => {
      const name = getLampNameFromFilename(file)
      const key = generateLampKey(name)
      
      return {
        key,
        name,
        image: `/images/${file}`,
        price: 19.9,
        description: getLampDescription(name)
      }
    })

    console.log(`Found ${chineseLamps.length} Chinese lantern images:`, chineseLampFiles)
    return chineseLamps

  } catch (error) {
    console.error('Error scanning for lantern images:', error)
    return DEFAULT_LAMPS
  }
}

// Client-side fallback lamps (static)
export const FALLBACK_LAMPS: Lamp[] = DEFAULT_LAMPS

// Export for potential client-side usage
export type { Lamp }