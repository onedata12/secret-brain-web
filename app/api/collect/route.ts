import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchPapers } from '@/lib/semantic-scholar'

export async function POST() {
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('*')
    .eq('active', true)

  if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 })
  if (!topics?.length) return NextResponse.json({ error: '주제가 없습니다' }, { status: 400 })

  const { data: existing } = await supabase.from('papers').select('id')
  const existingIds = new Set((existing || []).map((p: any) => p.id))

  let totalAdded = 0

  for (const topic of topics) {
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
        const { error } = await supabase.from('papers').insert(newPapers)
        if (!error) totalAdded += newPapers.length
      }
    } catch (e) {
      console.error(`수집 오류 (${topic.name}):`, e)
    }
  }

  return NextResponse.json({ added: totalAdded })
}
