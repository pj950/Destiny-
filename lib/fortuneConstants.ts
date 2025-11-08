export type FortuneCategory = 
  | '事业运' | '财富运' | '感情运' | '婚姻运' | '家庭运' 
  | '健康运' | '考试运' | '官司诉讼' | '旅行出行' | '求子育儿' 
  | '置业投资' | '买房置业' | '风水运势' | '寻物失物' | '综合运途'

export const categories: FortuneCategory[] = [
  '事业运', '财富运', '感情运', '婚姻运', '家庭运',
  '健康运', '考试运', '官司诉讼', '旅行出行', '求子育儿',
  '置业投资', '买房置业', '风水运势', '寻物失物', '综合运途'
]

export const categoryIcons: Record<FortuneCategory, string> = {
  '事业运': '💼',
  '财富运': '💰',
  '感情运': '❤️',
  '婚姻运': '💑',
  '家庭运': '👨‍👩‍👧‍👦',
  '健康运': '🏥',
  '考试运': '📚',
  '官司诉讼': '⚖️',
  '旅行出行': '✈️',
  '求子育儿': '👶',
  '置业投资': '📈',
  '买房置业': '🏠',
  '风水运势': '🏮',
  '寻物失物': '🔍',
  '综合运途': '🌟'
}

export const categoryGradients: Record<FortuneCategory, string> = {
  '事业运': 'from-blue-500 to-blue-600',
  '财富运': 'from-yellow-500 to-yellow-600',
  '感情运': 'from-red-500 to-pink-600',
  '婚姻运': 'from-pink-500 to-rose-600',
  '家庭运': 'from-orange-500 to-orange-600',
  '健康运': 'from-green-500 to-green-600',
  '考试运': 'from-purple-500 to-purple-600',
  '官司诉讼': 'from-indigo-500 to-indigo-600',
  '旅行出行': 'from-cyan-500 to-cyan-600',
  '求子育儿': 'from-amber-500 to-amber-600',
  '置业投资': 'from-emerald-500 to-emerald-600',
  '买房置业': 'from-stone-500 to-stone-600',
  '风水运势': 'from-violet-500 to-violet-600',
  '寻物失物': 'from-lime-500 to-lime-600',
  '综合运途': 'from-fuchsia-500 to-fuchsia-600'
}

export const levelColors = {
  '上上': 'text-mystical-rose-700',
  '上吉': 'text-mystical-gold-500',
  '中吉': 'text-mystical-gold-600',
  '下吉': 'text-mystical-cyan-900',
  '凶': 'text-mystical-purple-800'
}
