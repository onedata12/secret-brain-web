import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name) return NextResponse.json([], { status: 400 })

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `사용자가 "${name}"라는 주제로 논문을 수집하려 합니다.

이 주제와 관련된 추천 주제 6개를 JSON 배열로만 반환하세요. 각 항목은:
- name: 한국어 주제명 (짧고 명확하게)
- query: Semantic Scholar 검색용 영어 쿼리 (meta-analysis 또는 systematic review 포함)

예시 형식:
[{"name":"수면과 기억력","query":"sleep memory consolidation meta-analysis"},...]

JSON만 반환, 설명 없이.`
    }]
  })

  try {
    const text = (msg.content[0] as { text: string }).text.trim()
    const json = text.replace(/```json\n?|\n?```/g, '')
    return NextResponse.json(JSON.parse(json))
  } catch {
    return NextResponse.json([])
  }
}
