import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { searchPapersOpenAlex } from '@/lib/openalex'
import { translateToSearchQuery } from '@/lib/query-translate'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function translateTitles(papers: any[]): Promise<string[]> {
  const titles = papers.map((p, i) => `${i + 1}. ${p.title}`).join('\n')
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `다음 영어 논문 제목들을 자연스러운 한국어로 번역해줘. 학술 용어는 유지하되 읽기 쉽게.

${titles}

형식: 번호 없이 각 줄에 한국어 번역만. 순서 그대로.`
    }]
  })
  const translated = (msg.content[0] as { text: string }).text.trim().split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
  return translated
}

async function generateAnswer(query: string, papers: any[]): Promise<string> {
  const paperSummaries = papers.slice(0, 8).map((p, i) =>
    `[논문 ${i + 1}] ${p.title} (${p.year}, 인용 ${p.citationCount}회)\n${p.abstract?.slice(0, 300)}...`
  ).join('\n\n')

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `너는 "시크릿 브레인" 서비스의 AI야. 시크릿 브레인은 정신없이 하루를 흘려보내는 사람들이 큰 그림을 그리고 삶을 주도적으로 살도록 돕는 올인원 할 일 관리 시스템이야.

사용자 질문에 논문 근거로 답변해줘. 시크릿 브레인 사용자에게 이 인사이트가 어떻게 도움이 되는지 연결해줘.

질문: "${query}"

관련 논문들:
${paperSummaries}

조건:
- 반말로 친근하게, 친한 선배처럼
- "연구에 따르면~", "메타분석 결과~" 식으로 근거 언급
- 숫자/통계 포함
- 실생활 적용법 포함
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
  // 코드블록 제거
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
    paper_title_ko: paper.titleKo || null,
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
  const body = await req.json()
  const { query, selectedPapers } = body

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        let newPapers: any[]
        let papers: any[] = []

        if (selectedPapers?.length) {
          send({ pct: 5, msg: `📋 선택한 ${selectedPapers.length}개 논문으로 카드 생성 시작` })
          const { data: existingCards } = await supabase.from('cards').select('id')
          const existingIds = new Set((existingCards || []).map((c: any) => c.id))

          // selectedPapers에서 _raw가 있으면 사용, 없으면 직접 사용
          newPapers = selectedPapers
            .filter((p: any) => !existingIds.has(p.paperId))
            .map((p: any) => ({
              ...(p._raw || {}),
              paperId: p.paperId,
              title: p._raw?.title || p.titleEn || p.title,
              abstract: p._raw?.abstract || p.abstract || '',
              year: p._raw?.year || p.year,
              citationCount: p._raw?.citationCount || p.citations || 0,
              evidenceLevel: p._raw?.evidenceLevel || p.evidenceLevel || '📄 일반 논문',
              doiUrl: p._raw?.doiUrl || p.doiUrl || null,
              pdfUrl: p._raw?.pdfUrl || null,
              authors: p._raw?.authors || p.authors || [],
              titleKo: p.titleKo,
            }))
          papers = newPapers

          if (!newPapers.length) {
            send({ pct: 100, msg: '📌 이미 수집된 논문들이에요.', done: true, added: 0, answer: '' })
            controller.close()
            return
          }
          send({ pct: 10, msg: `✨ ${newPapers.length}개 신규 논문 처리 시작` })
        } else {
          send({ pct: 3, msg: `🔍 "${query}" 검색어 변환 중...` })
          const searchQuery = await translateToSearchQuery(query)
          send({ pct: 8, msg: `📌 검색어: ${searchQuery}` })

          send({ pct: 10, msg: '📚 OpenAlex에서 논문 검색 중...' })
          papers = await searchPapersOpenAlex(searchQuery, 20)

          if (!papers.length) {
            send({ pct: 100, msg: '❌ 관련 논문을 찾지 못했어요.', done: true, added: 0, answer: '', papers: [] })
            controller.close()
            return
          }
          send({ pct: 15, msg: `✅ ${papers.length}개 논문 발견!` })

          send({ pct: 18, msg: '🌐 논문 제목 번역 중...' })
          const koTitles = await translateTitles(papers)
          const papersWithKo = papers.map((p: any, i: number) => ({ ...p, titleKo: koTitles[i] || p.title }))
          send({ pct: 25, msg: '✅ 번역 완료!', papers: papersWithKo.map((p: any) => ({
            paperId: p.paperId, titleEn: p.title, titleKo: p.titleKo,
            year: p.year, citations: p.citationCount, evidenceLevel: p.evidenceLevel,
            doiUrl: p.doiUrl, status: 'pending',
          })) })

          const { data: existingCards } = await supabase.from('cards').select('id')
          const existingIds = new Set((existingCards || []).map((c: any) => c.id))
          newPapers = papersWithKo.filter((p: any) => !existingIds.has(p.paperId)).slice(0, 10)
          papers = papersWithKo
        }

        if (!newPapers.length) {
          send({ pct: 100, msg: '📌 이미 수집된 논문들이에요.', done: true, added: 0, answer: '' })
          controller.close()
          return
        }
        send({ pct: 28, msg: `✨ 신규 ${newPapers.length}개 논문 카드 생성 시작` })

        // 카드 생성 — 최대 5개씩 (타임아웃 방지)
        const maxCards = Math.min(newPapers.length, 5)
        let added = 0
        const pctPerCard = 57 / maxCards

        for (let i = 0; i < maxCards; i++) {
          const paper = newPapers[i]
          const startPct = Math.round(28 + pctPerCard * i)
          send({ pct: startPct, msg: `🤖 카드 생성 중 (${i + 1}/${maxCards}): ${paper.titleKo || paper.title}` })

          try {
            const card = await generateCard(paper, query)
            const { error } = await supabase.from('cards').insert(card)
            if (error) {
              // ID 충돌이면 upsert 시도
              if (error.code === '23505') {
                send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `⏭ 이미 존재: ${card.headline || paper.title}`, paperStatus: { id: paper.paperId, status: 'skip' } })
              } else {
                send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `⚠️ 저장 실패: ${error.message}`, paperStatus: { id: paper.paperId, status: 'error' } })
              }
            } else {
              added++
              send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `✅ 완료 (${added}/${maxCards}): ${card.headline}`, paperStatus: { id: paper.paperId, status: 'done' } })
            }
          } catch (e: any) {
            send({ pct: startPct + Math.round(pctPerCard * 0.9), msg: `⚠️ 오류: ${e.message?.slice(0, 80)}`, paperStatus: { id: paper.paperId, status: 'error' } })
          }
        }

        if (newPapers.length > maxCards) {
          send({ pct: 86, msg: `ℹ️ 타임아웃 방지를 위해 ${maxCards}개만 생성했어요. 나머지는 다시 검색해서 추가할 수 있어요.` })
        }

        // 답변 생성
        send({ pct: 88, msg: '💡 질문에 대한 답변 생성 중...' })
        let answer = ''
        try {
          answer = await generateAnswer(query, papers)
          send({ pct: 95, msg: '✅ 답변 완성!' })
        } catch {
          send({ pct: 95, msg: '⚠️ 답변 생성 스킵' })
        }

        send({ pct: 100, msg: `🎉 ${added}개 카드 검토 대기 추가 완료!`, done: true, added, answer })
      } catch (e: any) {
        send({ pct: 100, msg: `❌ 오류: ${e.message}`, done: true, added: 0, answer: '' })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
