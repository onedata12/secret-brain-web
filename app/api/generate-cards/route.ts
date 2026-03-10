import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateCard(paper: any) {
  const prompt = `너는 복잡한 논문을 친한 친구처럼 쉽게 설명해주는 전문가야.
아래 논문을 읽고 인사이트 카드를 만들어줘.

**논문 정보**
- 제목: ${paper.title}
- 출판 연도: ${paper.year}
- 인용 수: ${paper.citation_count}회
- 근거 수준: ${paper.evidence_level}
- 주제: ${paper.search_topic}
- 초록: ${paper.abstract}

**아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만.**

{
  "paper_title_ko": "논문 제목을 한국어로 직역한 것 (학술적 느낌 유지)",
  "headline": "논문을 한 줄로 표현한 임팩트 있는 제목 (20자 이내, 말투: ~야/~해/~거야)",
  "one_line": "핵심 발견을 한 문장으로 (숫자/통계 포함하면 더 좋아)",
  "easy_explanation": "친한 친구한테 설명하듯이 3~4문장으로. 반말. 비유 써도 돼. 어려운 용어 금지.",
  "why_important": "왜 이게 중요한지 1~2문장. 일상생활과 연결해서.",
  "secret_brain_insight": "시크릿 브레인(할 일 관리 시스템) 사용자한테 들려줄 인사이트 문구. 2~3문장. 반말. 감성적으로.",
  "sns_copy": "SNS에 바로 쓸 수 있는 짧은 카피라이팅. 숫자/통계 강조. 이모지 1~2개 포함.",
  "landing_copy": "랜딩페이지에 쓸 신뢰감 있는 문구. 연구 근거 언급. 존댓말.",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  let text = (message.content[0] as any).text.trim()
  if (text.startsWith('```')) {
    text = text.split('```')[1]
    if (text.startsWith('json')) text = text.slice(4)
  }

  const cardData = JSON.parse(text)
  return {
    id: paper.id,
    topic: paper.search_topic,
    evidence_level: paper.evidence_level,
    paper_title: paper.title,
    year: paper.year,
    citations: paper.citation_count,
    authors: paper.authors,
    status: 'pending',
    doi_url: paper.doi_url,
    pdf_url: paper.pdf_url,
    abstract_text: paper.abstract,
    review_log: [],
    generated_at: new Date().toISOString(),
    reviewed_at: null,
    ...cardData,
  }
}

export async function POST() {
  const { data: papers } = await supabase
    .from('papers')
    .select('*')
    .eq('status', 'pending_explanation')

  const { data: existingCards } = await supabase.from('cards').select('id')
  const existingIds = new Set((existingCards || []).map((c: any) => c.id))

  const pending = (papers || []).filter((p: any) => !existingIds.has(p.id))

  if (!pending.length) return NextResponse.json({ generated: 0 })

  let generated = 0
  for (const paper of pending) {
    try {
      const card = await generateCard(paper)
      const { error } = await supabase.from('cards').insert(card)
      if (!error) {
        await supabase.from('papers').update({ status: 'explained' }).eq('id', paper.id)
        generated++
      }
    } catch (e) {
      console.error(`카드 생성 오류 (${paper.title?.slice(0, 30)}):`, e)
    }
  }

  return NextResponse.json({ generated })
}
