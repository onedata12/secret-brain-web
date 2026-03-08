import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { text } = await req.json()
  const truncated = text.length > 2000 ? text.slice(0, 2000) + '...' : text

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `아래 영어 텍스트를 문장 단위로 분리하고, 각 문장을 자연스러운 한국어로 번역해줘.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON 배열만:

[
  {"id": 1, "en": "영어 원문 문장", "ko": "한국어 번역 문장"},
  {"id": 2, "en": "영어 원문 문장", "ko": "한국어 번역 문장"}
]

번역할 텍스트:
${truncated}`
    }]
  })

  let response = (message.content[0] as any).text.trim()
  if (response.includes('```')) {
    const parts = response.split('```')
    for (const part of parts) {
      const p = part.startsWith('json') ? part.slice(4).trim() : part.trim()
      if (p.startsWith('[')) { response = p; break }
    }
  }

  const match = response.match(/\[[\s\S]*\]/)
  if (match) response = match[0]

  return NextResponse.json(JSON.parse(response))
}
