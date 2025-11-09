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
  '健康灯': '祈愿身体康健，精力充沛，远离疾病困扰。',
  '财运灯': '招财进宝，财运亨通，事业蒸蒸日上，财富滚滚来。',
  '招财灯': '广开财源，财运滚滚，生意兴隆财富多。',
  '暴富灯': '祈求意外之财，横财来临，财富飙升。',
  '回财灯': '追回失去的财富，财源重现，失而复得。',
  '偏财灯': '激活偏财运势，赌运提升，横财机遇。',
  '姻缘灯': '祈求姻缘美满，爱情甜蜜，找到心仪的另一半。',
  '正缘桃花灯': '招正缘桃花，良缘善缘，真爱相遇。',
  '斩烂桃花灯': '斩断烂桃花，驱逐破坏，重获清净。',
  '事业灯': '助力事业有成，前程似锦，工作顺利步步高。',
  '文昌灯': '开启文昌运，学业进步，考试顺利金榜题名。',
  '智慧灯': '开启智慧之门，头脑清晰，决策明智事业兴。',
  '求子灯': '祈求送子娘娘保佑，早得贵子，家庭圆满。',
  '安产灯': '祈求平安顺产，母子安康，生产顺利。',
  '添寿灯': '祈愿长命百岁，健康长寿，福寿双全。',
  '好运灯': '汇聚好运气运，诸事顺利，好事连连。',
  '消灾灯': '消除灾厄烦恼，趋吉避凶，化解危险。',
  '除秽灯': '净化身心，驱除邪气，清净光明。',
  '防小人灯': '防范小人陷害，事业无忧，前程光明。',
  '贵人灯': '贵人相助，人脉拓展，机遇眷顾。',
  '本命灯': '守护本命，增运加持，人生顺畅。',
  '太岁灯': '化解太岁冲克，平安度过本年，化凶为吉。',
  '三宝灯': '供奉三宝，修行护佑，身心清净。',
  '五福灯': '五福临门，福禄寿喜财，圆满人生。',
  '七星灯': '七星护驾，神力加持，大吉大利。',
  '九子离火灯': '九子齐心，火焰旺盛，事业辉煌。',
  '传愿灯': '传递愿力，心想事成，梦想成真。',
  '追忆灯': '缅怀故人，祭祀寄托，永远怀念。',
  '忏悔灯': '忏悔往昔，洗净罪孽，重获新生。',
  '顺风顺水灯': '一帆风顺，万事顺心，诸事如意。',
  '爱宠无忧灯': '祝福宠物安康，陪伴永远，爱宠无忧。',
  '发横财灯': '发横财，意外之喜，财运爆棚。',
  '四季平安灯': '四季平安，四时顺遂，全年吉祥安康。',
  '七星灯png': '七星护驾，神力加持，大吉大利。',
  '发横财灯png': '发横财，意外之喜，财运爆棚。'
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