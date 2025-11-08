import type { LampConfig } from './lamps.config'

// Client-side fallback lamps (static data only)
export const FALLBACK_LAMPS: LampConfig[] = [
  {
    key: 'lamp_1',
    name: '福运灯',
    image: '/images/p1.jpg',
    price: 19.9,
    description: '祈愿福泽绵延，守护家庭顺遂与喜乐。'
  },
  {
    key: 'lamp_2',
    name: '安康灯',
    image: '/images/p2.jpg',
    price: 19.9,
    description: '点亮身心安泰之光，为爱的人带来平安守护。'
  },
  {
    key: 'lamp_3',
    name: '财源灯',
    image: '/images/p3.jpg',
    price: 19.9,
    description: '招聚金气财富，助事业与财运蒸蒸日上。'
  },
  {
    key: 'lamp_4',
    name: '事业灯',
    image: '/images/p4.jpg',
    price: 19.9,
    description: '赐予勇气与灵感，护佑事业突破新境界。'
  }
]
