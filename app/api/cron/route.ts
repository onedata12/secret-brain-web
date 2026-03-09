import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchPapers } from '@/lib/semantic-scholar'

export async function GET() {
  // 오늘 수집할 주제 1개만 처리 (Vercel 10s 타임아웃 대응)
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('active', true)

  if (!topics?.length) return NextResponse.json({ ok: true, added: 0 })

  const { data: existing } = await supabase.from('papers').select('id')
  const existingIds = new Set((existing || []).map((p: any) => p.id))

  // 하루에 하나씩 순환
  const dayIndex = Math.floor(Date.now() / 86400000) % topics.length
  const topic = topics[dayIndex]

  try {
    const papers = await searchPapers(topic.query || topic.name)
    const newPapers = papers
      .filter((p: any) => !existingIds.has(p.paperId))
      .map((p: any) => ({
        id: p.paperId,
        title: p.title,
        abstract: p.abstract,
        year: p.year,
        authors: p.authors,
        citation_count: p.citationCount || 0,
        evidence_level: p.evidenceLevel,
        trust_score: p.trustScore,
        search_topic: topic.name,
        doi_url: p.doiUrl,
        pdf_url: p.pdfUrl,
        status: 'pending_explanation',
      }))

    if (newPapers.length > 0) {
      await supabase.from('papers').insert(newPapers)
    }
    return NextResponse.json({ ok: true, topic: topic.name, added: newPapers.length })
  } catch (e) {
    console.error('Cron collect error:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
