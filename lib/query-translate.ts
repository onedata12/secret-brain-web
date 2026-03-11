import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 자주 쓰는 한국어 키워드 → 영어 매핑 (Haiku 실패 시 폴백)
const KOREAN_MAP: Record<string, string> = {
  '수면': 'sleep quality cognitive performance',
  '잠': 'sleep quality cognitive performance',
  '생산성': 'work productivity self-regulation',
  '습관': 'habit formation behavior change',
  '집중력': 'attention concentration cognitive performance',
  '집중': 'attention focus concentration',
  '스트레스': 'stress reduction psychological intervention',
  '운동': 'exercise cognitive function brain health',
  '운동과 뇌': 'exercise brain cognitive function',
  '동기부여': 'motivation goal setting achievement',
  '동기': 'motivation intrinsic extrinsic',
  '번아웃': 'burnout workplace exhaustion recovery',
  '감사일기': 'gratitude journaling wellbeing happiness',
  '감사': 'gratitude psychological wellbeing',
  '인간관계': 'social relationships wellbeing mental health',
  '명상': 'meditation mindfulness psychological wellbeing',
  '마음챙김': 'mindfulness meditation stress reduction',
  '기억력': 'memory cognitive enhancement learning',
  '학습': 'learning memory cognitive strategy',
  '독서': 'reading cognitive benefit comprehension',
  '다이어트': 'diet nutrition cognitive performance',
  '식단': 'nutrition diet brain health',
  '자존감': 'self-esteem confidence psychological wellbeing',
  '우울': 'depression intervention psychological treatment',
  '불안': 'anxiety reduction psychological intervention',
  '시간관리': 'time management productivity self-regulation',
  '의지력': 'willpower self-control ego depletion',
  '자기조절': 'self-regulation executive function control',
  '창의성': 'creativity cognitive innovation',
  '결정피로': 'decision fatigue ego depletion',
  '미루기': 'procrastination self-regulation intervention',
  '카페인': 'caffeine cognitive performance alertness',
  '커피': 'coffee caffeine cognitive function',
  '음악': 'music cognitive performance productivity',
  '산책': 'walking exercise cognitive benefit',
  '낮잠': 'nap sleep cognitive restoration',
  '멀티태스킹': 'multitasking cognitive switching cost',
  '목표': 'goal setting motivation achievement',
  '루틴': 'daily routine habit self-regulation',
  '행복': 'happiness subjective wellbeing psychology',
  '회복탄력성': 'resilience psychological recovery stress',
  '공부': 'studying learning cognitive strategy',
  '뇌': 'brain cognitive neuroscience function',
}

function findKoreanMatch(query: string): string | null {
  const q = query.trim()
  // 정확한 매칭
  if (KOREAN_MAP[q]) return KOREAN_MAP[q]
  // 부분 매칭 (키워드 포함)
  for (const [kr, en] of Object.entries(KOREAN_MAP)) {
    if (q.includes(kr)) return en
  }
  return null
}

export async function translateToSearchQuery(query: string): Promise<string> {
  // 이미 영어면 그대로
  if (/^[a-zA-Z\s\-]+$/.test(query.trim())) return query.trim()

  // 1차: 한국어 매핑 테이블
  const mapped = findKoreanMatch(query)
  if (mapped) return mapped

  // 2차: AI 번역 시도
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Convert Korean topic to English academic search query (5-6 words max).

Input: ${query}

Examples:
생산성 → work productivity self-regulation performance
수면 → sleep quality cognitive performance
습관 → habit formation behavior change

Return ONLY the English query:`
      }]
    })
    const result = (msg.content[0] as { text: string }).text.trim()
      .replace(/^"|"$/g, '')
      .replace(/^Query:\s*/i, '')
      .replace(/^Output:\s*/i, '')
      .split('\n')[0]
      .trim()

    // 영어 결과인지 검증
    if (result.length > 0 && result.length < 100 && /^[a-zA-Z\s\-]+$/.test(result)) {
      return result
    }
  } catch {}

  // 3차: 폴백 - 일반적인 심리학 검색어
  return 'psychology behavior wellbeing intervention'
}
