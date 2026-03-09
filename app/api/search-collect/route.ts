import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { searchPapersPubMed } from '@/lib/pubmed'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function queryToSearchTerms(query: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `You are helping find research papers for a Korean productivity/self-improvement tool called "시크릿 브레인" (Secret Brain - an all-in-one to-do and life management system). The goal is to find scientific evidence about human behavior, productivity, habits, and wellbeing.

Convert this Korean query to a PubMed search query in English. Focus on PRACTICAL human behavior research, NOT on academic/research methodology papers.

Korean query: "${query}"

Rules:
- Focus on: productivity, habits, cognition, sleep, exercise, stress, motivation, wellbeing, behavior change
- Use behavioral/psychological terms, NOT academic process terms
- Always end with: meta-analysis OR "systematic review"
- Return ONLY the query string, nothing else

Examples:
- "생산성" → "work productivity task performance time management self-regulation meta-analysis OR systematic review"
- "수면" → "sleep quality cognitive performance memory consolidation meta-analysis OR systematic review"
- "운동과 뇌" → "exercise physical activity cognitive function memory brain meta-analysis OR systematic review"
- "스트레스 줄이기" → "stress reduction coping psychological wellbeing intervention meta-analysis OR systematic review"
- "습관 만들기" → "habit formation behavior change implementation intentions meta-analysis OR systematic review"
- "집중력" → "attention focus concentration cognitive performance intervention meta-analysis OR systematic review"
- "동기부여" → "motivation goal setting self-efficacy achievement meta-analysis OR systematic review"

Query:`
    }]
  })
  return (msg.content[0] as { text: string }).text.trim().replace(/^"|"$/g, '')
}

async function generateAnswer(query: string, papers: any[]): Promise<string> {
  const paperSummaries = papers.slice(0, 8).map((p, i) =>
    `[논문 ${i + 1}] ${p.title} (${p.year})\n초록: ${p.abstract?.slice(0, 300)}...`
  ).join('\n\n')

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `너는 "시크릿 브레인" 서비스의 AI야. 시크릿 브레인은 정신없이 하루를 흘려보내는 사람들이 큰 그림을 그리고 삶을 주도적으로 살도록 돕는 올인원 할 일 관리 시스템이야.

사용자가 궁금해하는 내용에 대해 논문 근거를 바탕으로 답변해줘. 시크릿 브레인 사용자가 이 인사이트를 자신의 삶에 어떻게 적용할 수 있는지 연결해줘.

질문: "${query}"

관련 논문들:
${paperSummaries}

답변 조건:
- 반말로 친근하게, 친한 선배처럼
- 논문 근거 구체적으로 (숫자/통계 포함)
- "연구에 따르면~", "메타분석 결과~" 식으로 근거 언급
- 시크릿 브레인/할 일 관리/삶의 주도권과 연결
- 실생활 적용법 1~3가지 포함
- 3~4문단, 마크다운 없이 순수 텍스트`
    }]
  })
  return (msg.content[0] as { text: string }).text.trim()
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
  "secret_brain_insight": "시크릿 브레인(정신없이 사는 사람 → 삶을 주도하는 사람으로 바꿔주는 할 일 관리 시스템) 사용자에게. 이 연구가 왜 할 일 관리/시간 주도권과 연결되는지. 2~3문장. 반말. 감성적으로.",
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 1. 검색어 변환
        send({ pct: 3, msg: `🔍 "${query}" 검색어 변환 중...` })
        const searchQuery = await queryToSearchTerms(query)
        send({ pct: 8, msg: `📌 검색어: ${searchQuery}` })

        // 2. PubMed 검색
        send({ pct: 10, msg: '📚 PubMed에서 논문 검색 중...' })
        const papers = await searchPapersPubMed(searchQuery, 20)

        if (!papers.length) {
          send({ pct: 100, msg: '❌ 관련 논문을 찾지 못했어요.', done: true, added: 0, answer: '' })
          controller.close()
          return
        }
        send({ pct: 15, msg: `✅ ${papers.length}개 논문 발견!` })

        // 3. 기존 카드 제외
        const { data: existingCards } = await supabase.from('cards').select('id')
        const existingIds = new Set((existingCards || []).map((c: any) => c.id))
        const newPapers = papers.filter((p: any) => !existingIds.has(p.paperId)).slice(0, 10)

        if (!newPapers.length) {
          send({ pct: 100, msg: '📌 이미 수집된 논문들이에요.', done: true, added: 0, answer: '' })
          controller.close()
          return
        }
        send({ pct: 18, msg: `✨ 신규 ${newPapers.length}개 논문 카드 생성 시작` })

        // 4. 카드 생성 (10개)
        let added = 0
        const pctPerCard = 65 / newPapers.length

        for (let i = 0; i < newPapers.length; i++) {
          const paper = newPapers[i]
          const startPct = Math.round(18 + pctPerCard * i)
          send({ pct: startPct, msg: `🤖 카드 생성 중 (${i + 1}/${newPapers.length}): ${paper.title.slice(0, 45)}...` })

          try {
            const card = await generateCard(paper, query)
            const { error } = await supabase.from('cards').insert(card)
            if (error) {
              send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `⚠️ 저장 실패: ${error.message}` })
            } else {
              added++
              send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `✅ 완료 (${added}/${newPapers.length}): ${card.headline}` })
            }
          } catch (e: any) {
            send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `⚠️ 오류: ${e.message?.slice(0, 60)}` })
          }
        }

        // 5. 질문 답변 생성
        send({ pct: 88, msg: '💡 질문에 대한 답변 생성 중...' })
        const answer = await generateAnswer(query, papers)
        send({ pct: 95, msg: '✅ 답변 완성!' })

        send({ pct: 100, msg: `🎉 ${added}개 카드 검토 대기 추가 완료!`, done: true, added, answer })
      } catch (e: any) {
        send({ pct: 100, msg: `❌ 오류: ${e.message}`, done: true, added: 0, answer: '' })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
