import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { randomUUID } from 'crypto'

const SESSION_COOKIE_NAME = 'fortune_session'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

// Fortune stick data (100 sticks with various levels and texts)
const FORTUNE_STICKS = [
  // 上上 (Best) - 20 sticks
  { id: 1, level: '上上', text: '龙凤呈祥，万事亨通' },
  { id: 2, level: '上上', text: '紫气东来，福星高照' },
  { id: 3, level: '上上', text: '金玉满堂，富贵双全' },
  { id: 4, level: '上上', text: '春风得意，马到成功' },
  { id: 5, level: '上上', text: '吉星拱照，百事顺遂' },
  { id: 6, level: '上上', text: '福禄寿喜，四喜临门' },
  { id: 7, level: '上上', text: '鸿运当头，时来运转' },
  { id: 8, level: '上上', text: '心想事成，梦想成真' },
  { id: 9, level: '上上', text: '贵人相助，化险为夷' },
  { id: 10, level: '上上', text: '天赐良缘，花好月圆' },
  { id: 11, level: '上上', text: '财源广进，日进斗金' },
  { id: 12, level: '上上', text: '文思泉涌，才华横溢' },
  { id: 13, level: '上上', text: '身体健康，精力充沛' },
  { id: 14, level: '上上', text: '家庭和睦，幸福美满' },
  { id: 15, level: '上上', text: '事业有成，步步高升' },
  { id: 16, level: '上上', text: '学业进步，金榜题名' },
  { id: 17, level: '上上', text: '出入平安，一路顺风' },
  { id: 18, level: '上上', text: '春风得意，前程似锦' },
  { id: 19, level: '上上', text: '德高望重，受人尊敬' },
  { id: 20, level: '上上', text: '五福临门，吉祥如意' },
  
  // 上吉 (Good) - 25 sticks
  { id: 21, level: '上吉', text: '时来运转，渐入佳境' },
  { id: 22, level: '上吉', text: '小有成就，继续努力' },
  { id: 23, level: '上吉', text: '贵人出现，机会来临' },
  { id: 24, level: '上吉', text: '柳暗花明，峰回路转' },
  { id: 25, level: '上吉', text: '水到渠成，自然有成' },
  { id: 26, level: '上吉', text: '和气生财，家和万事兴' },
  { id: 27, level: '上吉', text: '稳扎稳打，循序渐进' },
  { id: 28, level: '上吉', text: '得道多助，失道寡助' },
  { id: 29, level: '上吉', text: '厚积薄发，大器晚成' },
  { id: 30, level: '上吉', text: '守得云开见月明' },
  { id: 31, level: '上吉', text: '山重水复疑无路，柳暗花明又一村' },
  { id: 32, level: '上吉', text: '千里之行，始于足下' },
  { id: 33, level: '上吉', text: '精诚所至，金石为开' },
  { id: 34, level: '上吉', text: '天道酬勤，自强不息' },
  { id: 35, level: '上吉', text: '海纳百川，有容乃大' },
  { id: 36, level: '上吉', text: '积善之家，必有余庆' },
  { id: 37, level: '上吉', text: '谦受益，满招损' },
  { id: 38, level: '上吉', text: '否极泰来，转危为安' },
  { id: 39, level: '上吉', text: '乘风破浪，勇往直前' },
  { id: 40, level: '上吉', text: '百尺竿头，更进一步' },
  { id: 41, level: '上吉', text: '机不可失，时不再来' },
  { id: 42, level: '上吉', text: '集腋成裘，聚沙成塔' },
  { id: 43, level: '上吉', text: '精益求精，尽善尽美' },
  { id: 44, level: '上吉', text: '顺水推舟，事半功倍' },
  { id: 45, level: '上吉', text: '锦上添花，美上加美' },
  
  // 中吉 (Medium) - 25 sticks
  { id: 46, level: '中吉', text: '平平淡淡，安安稳稳' },
  { id: 47, level: '中吉', text: '守成待时，不可急进' },
  { id: 48, level: '中吉', text: '小有波折，终能化解' },
  { id: 49, level: '中吉', text: '按部就班，循序渐进' },
  { id: 50, level: '中吉', text: '知足常乐，随遇而安' },
  { id: 51, level: '中吉', text: '静观其变，待机而动' },
  { id: 52, level: '中吉', text: '中规中矩，不偏不倚' },
  { id: 53, level: '中吉', text: '稳中求进，循序渐进' },
  { id: 54, level: '中吉', text: '不急不躁，顺其自然' },
  { id: 55, level: '中吉', text: '小富即安，知足常乐' },
  { id: 56, level: '中吉', text: '平安是福，健康为本' },
  { id: 57, level: '中吉', text: '淡泊名利，宁静致远' },
  { id: 58, level: '中吉', text: '量力而行，适可而止' },
  { id: 59, level: '中吉', text: '审时度势，量体裁衣' },
  { id: 60, level: '中吉', text: '居安思危，有备无患' },
  { id: 61, level: '中吉', text: '循序渐进，水滴石穿' },
  { id: 62, level: '中吉', text: '中庸之道，不偏不倚' },
  { id: 63, level: '中吉', text: '小挫不馁，继续前行' },
  { id: 64, level: '中吉', text: '稳扎稳打，步步为营' },
  { id: 65, level: '中吉', text: '顺其自然，不可强求' },
  { id: 66, level: '中吉', text: '适可而止，见好就收' },
  { id: 67, level: '中吉', text: '不骄不躁，稳步前进' },
  { id: 68, level: '中吉', text: '随遇而安，知足常乐' },
  { id: 69, level: '中吉', text: '平安无事，即是福气' },
  { id: 70, level: '中吉', text: '按图索骥，循规蹈矩' },
  
  // 下吉 (Low) - 20 sticks
  { id: 71, level: '下吉', text: '小有阻碍，需要耐心' },
  { id: 72, level: '下吉', text: '事多磨砺，需要坚持' },
  { id: 73, level: '下吉', text: '前路坎坷，谨慎前行' },
  { id: 74, level: '下吉', text: '小有损失，及时止损' },
  { id: 75, level: '下吉', text: '事与愿违，需要变通' },
  { id: 76, level: '下吉', text: '进退两难，需要智慧' },
  { id: 77, level: '下吉', text: '波折不断，需要毅力' },
  { id: 78, level: '下吉', text: '时机未到，需要等待' },
  { id: 79, level: '下吉', text: '困难重重，需要勇气' },
  { id: 80, level: '下吉', text: '事倍功半，需要方法' },
  { id: 81, level: '下吉', text: '欲速不达，需要耐心' },
  { id: 82, level: '下吉', text: '竹篮打水，需要改变' },
  { id: 83, level: '下吉', text: '力不从心，需要帮助' },
  { id: 84, level: '下吉', text: '事多不顺，需要反思' },
  { id: 85, level: '下吉', text: '进退维谷，需要决断' },
  { id: 86, level: '下吉', text: '欲罢不能，需要取舍' },
  { id: 87, level: '下吉', text: '骑虎难下，需要智慧' },
  { id: 88, level: '下吉', text: '左右为难，需要权衡' },
  { id: 89, level: '下吉', text: '进退失据，需要重新' },
  { id: 90, level: '下吉', text: '前功尽弃，需要重来' },
  
  // 凶 (Bad) - 10 sticks
  { id: 91, level: '凶', text: '祸不单行，需要谨慎' },
  { id: 92, level: '凶', text: '雪上加霜，暂避锋芒' },
  { id: 93, level: '凶', text: '四面楚歌，需要转机' },
  { id: 94, level: '凶', text: '山穷水尽，需要变通' },
  { id: 95, level: '凶', text: '危机四伏，需要防范' },
  { id: 96, level: '凶', text: '困难重重，需要坚持' },
  { id: 97, level: '凶', text: '事多不顺，需要改变' },
  { id: 98, level: '凶', text: '前路迷茫，需要指引' },
  { id: 99, level: '凶', text: '屡战屡败，需要反思' },
  { id: 100, level: '凶', text: '时运不济，需要等待' }
]

// AI analysis prompt template
const getAnalysisPrompt = (category: string, stickText: string, stickLevel: string) => {
  return `作为一位专业的命理大师，请为以下签文提供详细的解读：

签文类别：${category}
签文等级：${stickLevel}
签文内容：${stickText}

请从以下几个方面进行解读：
1. 签文寓意：解释签文的深层含义
2. 运势分析：分析当前的整体运势
3. 具体建议：针对${category}方面提供实用的建议
4. 注意事项：提醒需要警惕的问题
5. 改运方法：提供改善运势的方法

请用中文回答，语言要通俗易懂，既有传统文化底蕴，又要贴近现代生活。回答要积极正面，即使是下下签也要给出希望和指导。`
}

const buildFortunePayload = (fortune: any) => ({
  id: fortune.id,
  category: fortune.category,
  stick_id: fortune.stick_id,
  stick_text: fortune.stick_text,
  stick_level: fortune.stick_level,
  ai_analysis: fortune.ai_analysis,
  created_at: fortune.created_at,
})

const serializeCookie = (name: string, value: string) => {
  const expires = `Max-Age=${SESSION_COOKIE_MAX_AGE}`
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${name}=${value}; Path=/; ${expires}; HttpOnly; SameSite=Lax${secure}`
}

const ensureSessionId = (req: NextApiRequest, res: NextApiResponse) => {
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME]
  if (!sessionId) {
    sessionId = randomUUID()
    const newCookie = serializeCookie(SESSION_COOKIE_NAME, sessionId)
    const existing = res.getHeader('Set-Cookie')
    if (!existing) {
      res.setHeader('Set-Cookie', newCookie)
    } else if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, newCookie])
    } else {
      res.setHeader('Set-Cookie', [existing, newCookie])
    }
  }
  return sessionId
}

// Initialize Gemini AI
let genAI: GoogleGenerativeAI | null = null
try {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set')
  }
  genAI = new GoogleGenerativeAI(apiKey)
} catch (error) {
  console.error('Failed to initialize Google Generative AI:', error)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Verify Bearer token and set user_id
  
  const sessionId = ensureSessionId(req, res)
  const { category } = req.body
  
  // Input validation
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ ok: false, message: 'Category is required and must be a string' })
  }
  
  const validCategories = ['事业', '财富', '感情', '健康', '学业']
  if (!validCategories.includes(category)) {
    return res.status(400).json({ ok: false, message: 'Invalid category. Must be one of: ' + validCategories.join(', ') })
  }
  
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  try {
    const { data: existingFortune, error: checkError } = await supabaseService
      .from('fortunes')
      .select('*')
      .eq('draw_date', today)
      .eq('session_id', sessionId)
      .maybeSingle()
    
    if (checkError) {
      return res.status(500).json({ ok: false, message: checkError.message })
    }
    
    if (existingFortune) {
      return res.status(200).json({ 
        ok: true,
        alreadyDrawn: true,
        message: '今日已抽签，请明天再来',
        fortune: buildFortunePayload(existingFortune)
      })
    }
    
    // Randomly select a fortune stick
    const randomIndex = Math.floor(Math.random() * FORTUNE_STICKS.length)
    const selectedStick = FORTUNE_STICKS[randomIndex]
    
    // Generate AI analysis
    let aiAnalysis: string | null = null
    if (!genAI) {
      aiAnalysis = 'AI解签功能暂未配置，请稍后再试。'
    } else {
      try {
        const model = genAI.getGenerativeModel({ 
          model: process.env.GEMINI_MODEL_SUMMARY || 'gemini-2.5-pro' 
        })
        
        const prompt = getAnalysisPrompt(category, selectedStick.text, selectedStick.level)
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
          )
        ]) as any
        
        const text = typeof result?.response?.text === 'function' ? result.response.text() : null
        aiAnalysis = (typeof text === 'string' && text.trim().length > 0) ? text.trim() : null
      } catch (aiError) {
        console.error('AI analysis failed:', aiError)
        aiAnalysis = 'AI解签暂时不可用，请稍后再试。'
      }
    }
    
    // Save to database
    const { data: fortune, error: insertError } = await supabaseService
      .from('fortunes')
      .insert([{
        user_id: null, // MVP: anonymous user
        session_id: sessionId,
        draw_date: today,
        category,
        stick_id: selectedStick.id,
        stick_text: selectedStick.text,
        stick_level: selectedStick.level,
        ai_analysis: aiAnalysis
      }])
      .select()
      .maybeSingle()
    
    if (insertError) {
      if (insertError.code === '23505') {
        const { data: conflictFortune } = await supabaseService
          .from('fortunes')
          .select('*')
          .eq('draw_date', today)
          .eq('session_id', sessionId)
          .maybeSingle()
        if (conflictFortune) {
          return res.status(200).json({
            ok: true,
            alreadyDrawn: true,
            message: '今日已抽签，请明天再来',
            fortune: buildFortunePayload(conflictFortune)
          })
        }
      }
      return res.status(500).json({ ok: false, message: insertError.message })
    }
    
    if (!fortune) {
      return res.status(500).json({ ok: false, message: 'Failed to save fortune' })
    }
    
    return res.json({ 
      ok: true,
      alreadyDrawn: false,
      fortune: buildFortunePayload(fortune)
    })
    
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}