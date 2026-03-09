function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return ''
  const words: string[] = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word
    }
  }
  return words.filter(Boolean).join(' ')
}

function getEvidenceLevel(title: string, abstract: string, type: string): string {
  const t = (title || '').toLowerCase()
  const a = (abstract || '').toLowerCase()
  if (t.includes('meta-analysis') || t.includes('meta analysis')) return '🥇 메타분석'
  if (t.includes('systematic review')) return '🥈 체계적 문헌고찰'
  if (t.includes('review')) return '🥉 리뷰 논문'
  if (a.includes('randomized') || a.includes('randomised')) return '🔬 무작위 대조 시험'
  return '📄 일반 논문'
}

function trustScore(title: string, abstract: string, citations: number): number {
  let score = 0
  const t = (title || '').toLowerCase()
  const a = (abstract || '').toLowerCase()
  if (t.includes('meta-analysis')) score += 50
  if (t.includes('systematic review')) score += 40
  if (t.includes('review')) score += 20
  if (a.includes('randomized')) score += 30
  score += Math.min(Math.floor(citations / 10), 20)
  return score
}

export async function searchPapersOpenAlex(query: string, maxResults = 20) {
  const params = new URLSearchParams({
    search: query,
    filter: 'has_abstract:true',
    'per-page': String(maxResults),
    // relevance_score 정렬이 기본값 (생략시 관련도순)
    select: 'id,title,abstract_inverted_index,publication_year,authorships,cited_by_count,doi,type',
    mailto: 'secretbrain@research.kr',
  })

  const res = await fetch(`https://api.openalex.org/works?${params}`)
  if (!res.ok) throw new Error(`OpenAlex API error: ${res.status}`)
  const data = await res.json()
  const works = data.results || []

  return works
    .map((w: any) => {
      const abstract = reconstructAbstract(w.abstract_inverted_index)
      const title = w.title || ''
      const citations = w.cited_by_count || 0
      const year = w.publication_year || 0
      const doi = w.doi?.replace('https://doi.org/', '') || ''

      return {
        paperId: w.id,
        title,
        abstract,
        year,
        authors: (w.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name || ''),
        citationCount: citations,
        evidenceLevel: getEvidenceLevel(title, abstract, w.type),
        trustScore: trustScore(title, abstract, citations),
        doiUrl: doi ? `https://doi.org/${doi}` : null,
        pdfUrl: null,
      }
    })
    .filter((p: any) => p.abstract && p.title)
    .sort((a: any, b: any) => b.trustScore - a.trustScore)
}
