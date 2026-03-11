import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchPapersOpenAlexPaged } from '@/lib/openalex'
import { translateToSearchQuery } from '@/lib/query-translate'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function translateTitles(papers: any[]): Promise<string[]> {
  if (!papers.length) return []
  const titles = papers.map((p, i) => `${i + 1}. ${p.title}`).join('\n')
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `영어 논문 제목들을 자연스러운 한국어로 번역해줘. 학술 용어 유지. 번호 없이 각 줄에 번역만.\n\n${titles}`
    }]
  })
  return (msg.content[0] as { text: string }).text.trim().split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
}

function getRecommendation(paper: any): { recommended: boolean; stars: number; reasons: string[] } {
  const reasons: string[] = []
  const ev = paper.evidenceLevel || ''

  if (ev.includes('메타분석')) reasons.push('메타분석')
  if (ev.includes('체계적 문헌고찰')) reasons.push('체계적 문헌고찰')
  if (ev.includes('리뷰')) reasons.push('리뷰 논문')
  if (paper.citationCount > 500) reasons.push(`인용 ${paper.citationCount.toLocaleString()}회`)
  else if (paper.citationCount > 100) reasons.push(`인용 ${paper.citationCount}회`)
  if (paper.year >= 2020) reasons.push('최신 연구')
  else if (paper.year >= 2018) reasons.push('최근 연구')

  const stars = (ev.includes('메타분석') ? 3 : ev.includes('체계적 문헌고찰') ? 2 : 1)
    + (paper.citationCount > 500 ? 2 : paper.citationCount > 100 ? 1 : 0)
    + (paper.year >= 2020 ? 1 : 0)

  return {
    recommended: ev.includes('메타분석') || ev.includes('체계적 문헌고찰') || stars >= 4,
    stars: Math.min(stars, 5),
    reasons,
  }
}

export async function POST(req: Request) {
  const { query, cursor, searchQuery: existingSearchQuery } = await req.json()
  if (!query?.trim()) return NextResponse.json({ error: '검색어 필요' }, { status: 400 })

  try {
    // 첫 검색이면 검색어 변환, "더 불러오기"면 기존 검색어 재사용
    const searchQuery = existingSearchQuery || await translateToSearchQuery(query)
    const { papers, nextCursor, totalCount } = await searchPapersOpenAlexPaged(searchQuery, 30, cursor || undefined)

    if (!papers.length) return NextResponse.json({ papers: [], searchQuery, nextCursor: null, totalCount })

    const koTitles = await translateTitles(papers)
    const result = papers.map((p: any, i: number) => {
      const rec = getRecommendation(p)
      return {
        paperId: p.paperId,
        titleEn: p.title,
        titleKo: koTitles[i] || p.title,
        abstract: p.abstract?.slice(0, 400),
        year: p.year,
        citations: p.citationCount,
        evidenceLevel: p.evidenceLevel,
        doiUrl: p.doiUrl,
        authors: p.authors,
        recommended: rec.recommended,
        stars: rec.stars,
        reasons: rec.reasons,
        _raw: p,
      }
    })

    return NextResponse.json({ papers: result, searchQuery, nextCursor, totalCount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
