import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { searchPapersPubMed } from '@/lib/pubmed'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 자연어 질문 → Semantic Scholar 검색 쿼리 변환
async function queryToSearchTerms(query: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `다음 질문을 Semantic Scholar에서 메타분석/체계적 문헌고찰을 찾기 위한 영어 검색 쿼리로 변환해줘. 쿼리만 반환, 설명 없이.

질문: "${query}"

예시 형식: "sleep quality cognitive performance meta-analysis"
쿼리:`
    }]
  })
  return (msg.content[0] as { text: string }).text.trim().replace(/^"|"$/g, '')
}

async function generateCard(paper: any, topic: string) {
  const prompt = `너는 복잡한 논문을 친한 친구처럼 쉽게 설명해주는 전문가야.

논문 제목: ${paper.title}
출판 연도: ${paper.year}
인용 수: ${paper.citationCount || 0}회
근거 수준: ${paper.evidenceLevel}
주제: ${topic}
초록: ${paper.abstract}

아래 JSON 형식으로만 응답해.

{
  "headline": "논문을 한 줄로 표현한 임팩트 있는 제목 (20자 이내, 말투: ~야/~해/~거야)",
  "one_line": "핵심 발견을 한 문장으로 (숫자/통계 포함)",
  "easy_explanation": "친한 친구한테 설명하듯이 3~4문장으로. 반말. 비유 써도 돼.",
  "why_important": "왜 이게 중요한지 1~2문장. 일상생활과 연결해서.",
  "secret_brain_insight": "시크릿 브레인(할 일 관리 시스템) 사용자한테 들려줄 인사이트 문구. 2~3문장. 반말. 감성적으로.",
  "sns_copy": "SNS에 바로 쓸 수 있는 짧은 카피라이팅. 숫자 강조. 이모지 1~2개.",
  "landing_copy": "랜딩페이지에 쓸 신뢰감 있는 문구. 연구 근거 언급. 존댓말.",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  let text = (message.content[0] as any).text.trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON 파싱 실패')
  const cardData = JSON.parse(match[0])

  return {
    id: paper.paperId,
    topic,
    evidence_level: paper.evidenceLevel,
    paper_title: paper.title,
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

export async function POST(req: Request) {
  const { query } = await req.json()
  if (!query?.trim()) return NextResponse.json({ error: '검색어를 입력해주세요' }, { status: 400 })

  const logs: string[] = []
  const errors: string[] = []

  try {
    // 1. 검색 쿼리 최적화
    logs.push(`🔍 "${query}" 검색 중...`)
    const searchQuery = await queryToSearchTerms(query)
    logs.push(`📌 검색어: ${searchQuery}`)

    // 2. 논문 검색
    const papers = await searchPapersPubMed(searchQuery, 10)
    if (!papers.length) {
      return NextResponse.json({ added: 0, logs, errors: ['관련 논문을 찾지 못했어요.'] })
    }
    logs.push(`📄 ${papers.length}개 논문 발견`)

    // 3. 이미 있는 카드 확인
    const { data: existingCards } = await supabase.from('cards').select('id')
    const existingIds = new Set((existingCards || []).map((c: any) => c.id))
    const newPapers = papers.filter((p: any) => !existingIds.has(p.paperId)).slice(0, 3)

    if (!newPapers.length) {
      return NextResponse.json({ added: 0, logs, message: '이미 수집된 논문들이에요.' })
    }
    logs.push(`✨ ${newPapers.length}개 신규 논문 카드 생성 중...`)

    // 4. 카드 생성 + 저장
    let added = 0
    for (const paper of newPapers) {
      try {
        const card = await generateCard(paper, query)
        const { error } = await supabase.from('cards').insert(card)
        if (error) {
          errors.push(`저장 실패 (${paper.title?.slice(0, 30)}): ${error.message}`)
        } else {
          added++
          logs.push(`✅ 카드 생성: ${card.headline}`)
        }
      } catch (e: any) {
        errors.push(`카드 생성 실패 (${paper.title?.slice(0, 30)}): ${e.message}`)
      }
    }

    return NextResponse.json({ added, logs, errors })
  } catch (e: any) {
    return NextResponse.json({ added: 0, logs, errors: [e.message] }, { status: 500 })
  }
}
