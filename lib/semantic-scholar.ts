const META_KEYWORDS = ['meta-analysis', 'systematic review', 'meta analysis', 'randomized controlled trial', 'rct', 'cochrane']

function calculateTrustScore(paper: any): number {
  let score = 0
  const title = (paper.title || '').toLowerCase()
  const abstract = (paper.abstract || '').toLowerCase()
  const pubTypes = paper.publicationTypes || []

  if (pubTypes.includes('Meta-Analysis')) score += 50
  if (pubTypes.includes('SystematicReview')) score += 40
  if (pubTypes.includes('Review')) score += 20
  if (pubTypes.includes('RCT') || pubTypes.includes('ClinicalTrial')) score += 30

  for (const kw of META_KEYWORDS) {
    if (title.includes(kw)) score += 15
    if (abstract.includes(kw)) score += 5
  }

  const citations = paper.citationCount || 0
  score += Math.min(Math.floor(citations / 10), 20)

  const year = paper.year || 0
  if (year >= 2020) score += 10
  else if (year >= 2015) score += 5

  return score
}

function getEvidenceLevel(paper: any): string {
  const pubTypes = paper.publicationTypes || []
  const title = (paper.title || '').toLowerCase()
  const abstract = (paper.abstract || '').toLowerCase()

  if (pubTypes.includes('Meta-Analysis') || title.includes('meta-analysis')) return '🥇 메타분석'
  if (pubTypes.includes('SystematicReview') || title.includes('systematic review')) return '🥈 체계적 문헌고찰'
  if (pubTypes.includes('Review') || title.includes('review')) return '🥉 리뷰 논문'
  if (pubTypes.includes('RCT') || abstract.includes('randomized')) return '🔬 무작위 대조 시험'
  return '📄 일반 논문'
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  const headers: Record<string, string> = {}
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY
  }

  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers })
    if (res.status === 429) {
      const wait = (i + 1) * 3000
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return res
  }
  throw new Error('Semantic Scholar API 요청 한도 초과. 잠시 후 다시 시도해주세요.')
}

export async function searchPapers(topic: string, maxResults = 20) {
  const query = topic.toLowerCase().includes('meta-analysis') || topic.toLowerCase().includes('systematic review')
    ? topic
    : `${topic} meta-analysis OR systematic review`

  const params = new URLSearchParams({
    query,
    limit: String(maxResults),
    fields: 'title,abstract,year,authors,citationCount,externalIds,openAccessPdf,publicationTypes'
  })

  const res = await fetchWithRetry(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`)
  if (!res.ok) throw new Error(`Semantic Scholar API error: ${res.status}`)

  const data = await res.json()
  const papers = data.data || []

  const scored = papers
    .filter((p: any) => p.abstract)
    .map((p: any) => ({
      ...p,
      trustScore: calculateTrustScore(p),
      evidenceLevel: getEvidenceLevel(p),
      searchTopic: topic,
      authors: (p.authors || []).slice(0, 3).map((a: any) => a.name),
      doiUrl: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null,
      pdfUrl: p.openAccessPdf?.url || null,
    }))
    .sort((a: any, b: any) => b.trustScore - a.trustScore)
    .slice(0, 10)

  return scored
}
