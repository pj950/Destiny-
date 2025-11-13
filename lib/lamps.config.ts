import fs from 'fs'
import path from 'path'
import { supabaseService } from './supabase'

interface Lamp {
  id: string  // UUID from database
  key: string
  name: string
  image: string
  price: number
  description?: string
}

// Default fallback lanterns when no Chinese images are found
const DEFAULT_LAMPS: Lamp[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    key: 'p1',
    name: '福运灯',
    image: '/images/p1.jpg',
    price: 19.9,
    description: '祈愿福泽绵延，守护家庭顺遂与喜乐。'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    key: 'p2',
    name: '安康灯',
    image: '/images/p2.jpg',
    price: 19.9,
    description: '点亮身心安泰之光，为爱的人带来平安守护。'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    key: 'p3',
    name: '财源灯',
    image: '/images/p3.jpg',
    price: 19.9,
    description: '招聚金气财富，助事业与财运蒸蒸日上。'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    key: 'p4',
    name: '事业灯',
    image: '/images/p4.jpg',
    price: 19.9,
    description: '赐予勇气与灵感，护佑事业突破新境界。'
  },
]

const IMAGES_DIRECTORY = path.join(process.cwd(), 'public', 'images')
const HAS_IMAGES_DIRECTORY = fs.existsSync(IMAGES_DIRECTORY)
const DEFAULT_LAMP_IMAGE = DEFAULT_LAMPS[0]?.image ?? '/images/p1.jpg'

interface DatabaseLampRecord {
  id: string
  lamp_key: string | null
}

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

// Function to generate lamp key from name
function generateLampKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
}

// Function to get description for lamp name
function getLampDescription(name: string): string {
  return LAMP_DESCRIPTIONS[name] || `点燃${name}，为您带来美好的祝福与守护。`
}

function resolveLampImage(name: string): string {
  const trimmedName = name.trim()

  if (!HAS_IMAGES_DIRECTORY) {
    console.warn('[getLampsConfig] Images directory not found, using default lamp image')
    return DEFAULT_LAMP_IMAGE
  }

  if (!trimmedName) {
    return DEFAULT_LAMP_IMAGE
  }

  const pngPath = path.join(IMAGES_DIRECTORY, `${trimmedName}.png`)
  if (fs.existsSync(pngPath)) {
    return `/images/${trimmedName}.png`
  }

  const svgPath = path.join(IMAGES_DIRECTORY, `${trimmedName}.svg`)
  if (fs.existsSync(svgPath)) {
    return `/images/${trimmedName}.svg`
  }

  console.warn(`[getLampsConfig] Missing image for lamp "${trimmedName}", using fallback image`)
  return DEFAULT_LAMP_IMAGE
}

// Server-side function to load lamp configurations
export async function getLampsConfig(): Promise<Lamp[]> {
  try {
    console.log('[getLampsConfig] Fetching lamps from database')

    const { data: lamps, error } = await supabaseService
      .from('lamps')
      .select('id, lamp_key')
      .order('lamp_key', { ascending: true })

    if (error) {
      console.warn('[getLampsConfig] Database error fetching lamps:', error)
    }

    if (lamps && lamps.length > 0) {
      const databaseLamps = lamps as DatabaseLampRecord[]

      const lampConfigs = databaseLamps
        .map((record) => {
          if (!record?.id) {
            console.warn('[getLampsConfig] Skipping lamp with missing id:', record)
            return null
          }

          const lampKey = record.lamp_key?.trim()
          if (!lampKey) {
            console.warn(`[getLampsConfig] Skipping lamp ${record.id} because lamp_key is missing`)
            return null
          }

          const config: Lamp = {
            id: record.id,
            key: generateLampKey(lampKey),
            name: lampKey,
            image: resolveLampImage(lampKey),
            price: 19.9,
            description: getLampDescription(lampKey)
          }

          console.log(`[getLampsConfig] Lamp ready: ${config.name} -> ${config.id}`)
          return config
        })
        .filter((lamp): lamp is Lamp => lamp !== null)

      if (lampConfigs.length > 0) {
        console.log(`[getLampsConfig] Returning ${lampConfigs.length} lamps from database`)
        return lampConfigs
      }

      console.warn('[getLampsConfig] Database lamps missing required data, falling back to defaults')
    } else {
      console.warn('[getLampsConfig] No lamps found in database')
    }
  } catch (error) {
    console.error('[getLampsConfig] Error fetching lamps:', error)
  }

  console.warn('[getLampsConfig] Using default fallback lamps')
  return DEFAULT_LAMPS
}


// Client-side fallback lamps (static)
export const FALLBACK_LAMPS: Lamp[] = DEFAULT_LAMPS

// Export for potential client-side usage
export type { Lamp }