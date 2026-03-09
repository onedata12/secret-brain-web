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
      content: `Convert this Korean topic/question to an optimized PubMed search query in English for finding meta-analyses and systematic reviews.

Korean: "${query}"

Rules:
- Use specific scientific English terms, include synonyms with OR
- Always end with: meta-analysis OR "systematic review"
- Return ONLY the query string

Examples:
- "생산성" → "work productivity performance time management meta-analysis OR systematic review"
- "수면" → "sleep quality cognitive performance insomnia meta-analysis OR systematic review"
- "운동과 뇌" → "exercise physical activity cognitive function brain neuroplasticity meta-analysis OR systematic review"
- "스트레스 줄이기" → "stress reduction psychological wellbeing burnout meta-analysis OR systematic review"
- "습관 만들기" → "habit formation behavior change self-regulation meta-analysis OR systematic review"
- "아침 루틴" → "morning routine circadian rhythm daily habits productivity meta-analysis OR systematic review"

Query:`
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 1. 검색어 변환
        send({ pct: 5, msg: `🔍 "${query}" 검색어 변환 중...` })
        const searchQuery = await queryToSearchTerms(query)
        send({ pct: 15, msg: `📌 검색어: ${searchQuery}` })

        // 2. PubMed 검색
        send({ pct: 20, msg: '📚 PubMed에서 논문 검색 중...' })
        const papers = await searchPapersPubMed(searchQuery, 15)

        if (!papers.length) {
          send({ pct: 100, msg: '❌ 관련 논문을 찾지 못했어요. 다른 검색어를 시도해보세요.', done: true, added: 0 })
          controller.close()
          return
        }
        send({ pct: 30, msg: `✅ ${papers.length}개 논문 발견!` })

        // 3. 이미 있는 카드 제외
        const { data: existingCards } = await supabase.from('cards').select('id')
        const existingIds = new Set((existingCards || []).map((c: any) => c.id))
        const newPapers = papers.filter((p: any) => !existingIds.has(p.paperId)).slice(0, 5)

        if (!newPapers.length) {
          send({ pct: 100, msg: '📌 이미 수집된 논문들이에요. 다른 검색어를 시도해보세요.', done: true, added: 0 })
          controller.close()
          return
        }
        send({ pct: 35, msg: `✨ 신규 ${newPapers.length}개 논문 카드 생성 시작` })

        // 4. 카드 생성
        let added = 0
        const errors: string[] = []
        const pctPerCard = 60 / newPapers.length

        for (let i = 0; i < newPapers.length; i++) {
          const paper = newPapers[i]
          const pct = Math.round(35 + pctPerCard * i)
          send({ pct, msg: `🤖 카드 생성 중 (${i + 1}/${newPapers.length}): ${paper.title.slice(0, 40)}...` })

          try {
            const card = await generateCard(paper, query)
            const { error } = await supabase.from('cards').insert(card)
            if (error) {
              errors.push(`저장 실패: ${error.message}`)
              send({ pct: pct + Math.round(pctPerCard * 0.8), msg: `⚠️ 저장 실패: ${error.message}` })
            } else {
              added++
              send({ pct: pct + Math.round(pctPerCard * 0.8), msg: `✅ 완료: ${card.headline}` })
            }
          } catch (e: any) {
            errors.push(e.message)
            send({ pct: pct + Math.round(pctPerCard * 0.8), msg: `⚠️ 오류: ${e.message?.slice(0, 50)}` })
          }
        }

        send({ pct: 100, msg: `🎉 ${added}개 카드가 검토 대기에 추가됐어요!`, done: true, added, errors })
      } catch (e: any) {
        send({ pct: 100, msg: `❌ 오류: ${e.message}`, done: true, added: 0, errors: [e.message] })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  })
}
