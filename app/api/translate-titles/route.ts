import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { titles } = await req.json()
  if (!titles?.length) return Response.json({ translations: [] })

  try {
    const numbered = titles.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `다음 영어 논문 제목들을 자연스러운 한국어로 번역해줘. 학술 용어는 유지하되 읽기 쉽게.

${numbered}

형식: 번호 없이 각 줄에 한국어 번역만. 순서 그대로. ${titles.length}개 모두 번역해.`
      }]
    })

    const text = (msg.content[0] as { text: string }).text.trim()
    const translations = text.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
    return Response.json({ translations })
  } catch {
    return Response.json({ translations: [] })
  }
}
