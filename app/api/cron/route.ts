import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { searchPapersOpenAlex } from '@/lib/openalex'
import { translateToSearchQuery } from '@/lib/query-translate'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateCard(paper: any, topic: string) {
  const prompt = `너는 복잡한 논문을 친한 친구처럼 쉽게 설명해주는 전문가야.

논문 제목: ${paper.title}
출판 연도: ${paper.year}
인용 수: ${paper.citationCount || 0}회
근거 수준: ${paper.evidenceLevel}
주제: ${topic}
초록: ${paper.abstract}

아래 JSON 형식으로만 응답해. 반드시 유효한 JSON만 출력해. 코드블록(\`\`\`) 없이.

{
  "headline": "논문을 한 줄로 표현한 임팩트 있는 제목 (20자 이내, 말투: ~야/~해/~거야)",
  "one_line": "핵심 발견을 한 문장으로 (숫자/통계 포함)",
  "easy_explanation": "친한 친구한테 설명하듯이 3~4문장으로. 반말. 비유 써도 돼.",
  "why_important": "왜 이게 중요한지 1~2문장. 일상생활과 연결해서.",
  "secret_brain_insight": "시크릿 브레인 사용자에게. 이 연구가 왜 할 일 관리/시간 주도권과 연결되는지. 2~3문장. 반말. 감성적으로.",
  "sns_copy": "SNS에 바로 쓸 수 있는 짧은 카피라이팅. 숫자 강조. 이모지 1~2개.",
  "landing_copy": "랜딩페이지에 쓸 신뢰감 있는 문구. 연구 근거 언급. 존댓말.",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  let text = (message.content[0] as any).text.trim()
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON not found in response')
  const cardData = JSON.parse(match[0])
  delete cardData.paper_title_ko

  return {
    id: paper.paperId,
    topic,
    evidence_level: paper.evidenceLevel,
    paper_title: paper.title,
    paper_title_ko: null,
    year: paper.year,
    citations: paper.citationCount || 0,
    authors: paper.authors || [],
    status: 'pending',
    doi_url: paper.doiUrl || null,
    pdf_url: paper.pdfUrl || null,
    abstract_text: paper.abstract,
    review_log: [],
    generated_at: new Date().toISOString(),
    reviewed_at: null,
    ...cardData,
  }
}


export async function GET() {
  try {
    const { data: topics } = await supabase
      .from('topics')
      .select('*')
      .eq('active', true)

    if (!topics?.length) return NextResponse.json({ ok: true, added: 0, reason: 'no active topics' })

    // 하루에 하나씩 순환
    const dayIndex = Math.floor(Date.now() / 86400000) % topics.length
    const topic = topics[dayIndex]

    // 검색어 변환
    const searchQuery = await translateToSearchQuery(topic.query || topic.name)

    // OpenAlex에서 논문 검색
    const papers = await searchPapersOpenAlex(searchQuery, 10)
    if (!papers.length) return NextResponse.json({ ok: true, topic: topic.name, added: 0, reason: 'no papers found' })

    // 기존 카드와 중복 제거
    const { data: existingCards } = await supabase.from('cards').select('id')
    const existingIds = new Set((existingCards || []).map((c: any) => c.id))
    const newPapers = papers.filter((p: any) => !existingIds.has(p.paperId))

    if (!newPapers.length) return NextResponse.json({ ok: true, topic: topic.name, added: 0, reason: 'all duplicates' })

    // 카드 생성 (타임아웃 방지: 최대 2개)
    let added = 0
    for (const paper of newPapers.slice(0, 2)) {
      try {
        const card = await generateCard(paper, topic.name)
        const { error } = await supabase.from('cards').insert(card)
        if (!error) added++
      } catch (e) {
        console.error('Cron card error:', e)
      }
    }

    return NextResponse.json({ ok: true, topic: topic.name, searched: papers.length, added })
  } catch (e: any) {
    console.error('Cron error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
