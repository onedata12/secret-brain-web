function getEvidenceLevel(title: string, abstract: string): string {
  const t = title.toLowerCase()
  const a = abstract.toLowerCase()
  if (t.includes('meta-analysis') || t.includes('meta analysis')) return '🥇 메타분석'
  if (t.includes('systematic review')) return '🥈 체계적 문헌고찰'
  if (t.includes('review')) return '🥉 리뷰 논문'
  if (a.includes('randomized') || a.includes('randomised')) return '🔬 무작위 대조 시험'
  return '📄 일반 논문'
}

function calculateTrustScore(title: string, abstract: string, citationCount: number): number {
  let score = 0
  const t = title.toLowerCase()
  const a = abstract.toLowerCase()
  if (t.includes('meta-analysis')) score += 50
  if (t.includes('systematic review')) score += 40
  if (t.includes('review')) score += 20
  if (a.includes('randomized')) score += 30
  score += Math.min(Math.floor(citationCount / 10), 20)
  return score
}

export async function searchPapersPubMed(query: string, maxResults = 10) {
  // 1단계: PubMed에서 논문 ID 검색
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query + ' meta-analysis OR systematic review')}&retmax=${maxResults}&retmode=json&sort=relevance`

  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) throw new Error(`PubMed 검색 실패: ${searchRes.status}`)
  const searchData = await searchRes.json()
  const ids: string[] = searchData.esearchresult?.idlist || []
  if (!ids.length) return []

  // 2단계: 논문 상세 정보 가져오기
  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`
  const fetchRes = await fetch(fetchUrl)
  if (!fetchRes.ok) throw new Error(`PubMed 상세 정보 실패: ${fetchRes.status}`)
  const xml = await fetchRes.text()

  // XML 파싱 (간단하게 regex 사용)
  const articles: any[] = []
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)

  for (const match of articleMatches) {
    const articleXml = match[1]

    const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/)
    const titleMatch = articleXml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)
    const abstractMatch = articleXml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)
    const doiMatch = articleXml.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)

    const authorMatches = [...articleXml.matchAll(/<LastName>([\s\S]*?)<\/LastName>[\s\S]*?<ForeName>([\s\S]*?)<\/ForeName>/g)]

    const pmid = pmidMatch?.[1] || ''
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
    const abstract = abstractMatch?.map(m => m.replace(/<[^>]+>/g, '')).join(' ').trim() || ''
    const year = parseInt(yearMatch?.[1] || '0')
    const doi = doiMatch?.[1]?.trim() || ''
    const authors = authorMatches.slice(0, 3).map(m => `${m[2]} ${m[1]}`.trim())

    if (!title || !abstract) continue

    articles.push({
      paperId: `pmid_${pmid}`,
      title,
      abstract,
      year,
      authors,
      citationCount: 0,
      evidenceLevel: getEvidenceLevel(title, abstract),
      trustScore: calculateTrustScore(title, abstract, 0),
      doiUrl: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      pdfUrl: null,
    })
  }

  return articles.sort((a, b) => b.trustScore - a.trustScore)
}
