import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { deepScanOpenAlex } from '@/lib/openalex'
import { translateToSearchQuery } from '@/lib/query-translate'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 하나의 주제에서 다양한 검색어를 AI가 생성
async function generateSearchQueries(topic: string): Promise<string[]> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Generate 5 diverse English academic search queries for this topic: ${topic}

Rules: 3-6 words each, specific academic terms, cover different angles (theories, applications, meta-analyses, interventions). Return ONLY a JSON array.

Examples for "수면":
["sleep cognitive performance memory","sleep deprivation workplace productivity","sleep intervention meta-analysis","circadian rhythm mental health","sleep hygiene behavior change"]

Examples for "습관":
["habit formation behavior change","daily routine self-regulation","habit loop reward system","behavioral intervention habit","automaticity habit strength"]`
    }]
  })

  try {
    let text = (msg.content[0] as { text: string }).text.trim()
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const arr = JSON.parse(text)
    // 결과가 영어 배열인지 검증
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr
    throw new Error('invalid')
  } catch {
    // 폴백: 토픽을 영어로 그대로 사용하거나 기본 검색어
    const base = /^[a-zA-Z\s]+$/.test(topic) ? topic : 'psychology behavior'
    return [`${base} meta-analysis`, `${base} systematic review`, `${base} intervention`, `${base} cognitive`, `${base} wellbeing`]
  }
}

export async function POST(req: Request) {
  const { topicName, topicQuery } = await req.json()
  if (!topicName) return new Response('Missing topicName', { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        // 0. 한국어 → 영어 변환
        const englishTopic = await translateToSearchQuery(topicName)
        // 1. 검색어 생성
        send({ pct: 5, msg: `🤖 "${topicName}" 관련 다각도 검색어 생성 중... (${englishTopic})` })
        const queries = await generateSearchQueries(englishTopic)
        send({ pct: 10, msg: `📋 ${queries.length}개 검색어 생성: ${queries.join(' | ')}` })

        // 2. 기존 카드 ID 조회 (중복 방지)
        const { data: existingCards } = await supabase.from('cards').select('id')
        const existingIds = new Set((existingCards || []).map((c: any) => c.id))

        // 3. 각 검색어로 딥스캔
        const allPapers: any[] = []
        const seenIds = new Set<string>()
        const papersPerQuery = 40  // 쿼리당 최대 40개

        for (let qi = 0; qi < queries.length; qi++) {
          const q = queries[qi]
          const basePct = 10 + (qi / queries.length) * 60
          send({ pct: Math.round(basePct), msg: `🔍 검색 ${qi + 1}/${queries.length}: "${q}"` })

          try {
            const papers = await deepScanOpenAlex(q, papersPerQuery, (fetched, total) => {
              const p = basePct + (fetched / papersPerQuery) * (60 / queries.length)
              send({ pct: Math.round(Math.min(p, 70)), msg: `📚 "${q}" — ${fetched}개 수집 (전체 ${total}개 중)` })
            })

            let added = 0
            for (const paper of papers) {
              if (!seenIds.has(paper.paperId)) {
                seenIds.add(paper.paperId)
                allPapers.push({ ...paper, searchQuery: q })
                added++
              }
            }
            send({ pct: Math.round(basePct + 60 / queries.length), msg: `✅ "${q}" — ${added}개 신규 논문 (중복 제외)` })
          } catch (e: any) {
            send({ pct: Math.round(basePct + 60 / queries.length), msg: `⚠️ "${q}" 검색 실패: ${e.message?.slice(0, 50)}` })
          }
        }

        // 4. 신뢰도순 정렬 + 이미 수집된 것 표시
        allPapers.sort((a, b) => b.trustScore - a.trustScore)
        send({ pct: 75, msg: `📊 총 ${allPapers.length}개 고유 논문 수집 완료. 정렬 중...` })

        // 5. 결과 분류
        const newPapers = allPapers.filter(p => !existingIds.has(p.paperId))
        const alreadyCollected = allPapers.length - newPapers.length

        // 6. 통계
        const metaAnalyses = allPapers.filter(p => p.evidenceLevel.includes('메타분석')).length
        const systematicReviews = allPapers.filter(p => p.evidenceLevel.includes('체계적')).length
        const highCitation = allPapers.filter(p => p.citationCount >= 100).length

        send({ pct: 80, msg: `📊 메타분석 ${metaAnalyses}개 | 체계적 리뷰 ${systematicReviews}개 | 인용 100+ ${highCitation}개` })

        if (alreadyCollected > 0) {
          send({ pct: 82, msg: `📌 이미 수집됨: ${alreadyCollected}개 | 신규: ${newPapers.length}개` })
        }

        // 7. 결과 전송 (상위 100개)
        const topPapers = newPapers.slice(0, 100).map(p => ({
          paperId: p.paperId,
          titleEn: p.title,
          titleKo: '', // 클라이언트에서 필요 시 번역
          abstract: p.abstract?.slice(0, 300),
          year: p.year,
          citations: p.citationCount,
          evidenceLevel: p.evidenceLevel,
          doiUrl: p.doiUrl,
          authors: p.authors,
          trustScore: p.trustScore,
          recommended: p.trustScore >= 40,
          stars: Math.min(Math.ceil(p.trustScore / 15), 5),
          reasons: [],
          searchQuery: p.searchQuery,
          _raw: p,
          status: 'pending' as const,
        }))

        send({
          pct: 90,
          msg: `✅ 상위 ${topPapers.length}개 논문 준비 완료`,
          papers: topPapers,
          stats: {
            total: allPapers.length,
            new: newPapers.length,
            alreadyCollected,
            metaAnalyses,
            systematicReviews,
            highCitation,
          }
        })

        send({ pct: 100, msg: `🎉 딥스캔 완료! ${topPapers.length}개 논문에서 원하는 것을 선택하세요.`, done: true })
      } catch (e: any) {
        send({ pct: 100, msg: `❌ 오류: ${e.message}`, done: true })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    }
  })
}
