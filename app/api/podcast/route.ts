import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { cards } = await req.json()

  const cardsText = cards.slice(0, 5).map((card: any, i: number) => `
논문 ${i + 1}: ${card.paper_title}
핵심: ${card.one_line}
설명: ${card.easy_explanation}
중요성: ${card.why_important}
시크릿 브레인 인사이트: ${card.secret_brain_insight}
---`).join('')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `아래 논문 카드들을 바탕으로 20분 분량의 데일리 팟캐스트 스크립트를 써줘.

조건:
- 친한 친구처럼 반말로 자연스럽게
- 논문 소개 → 핵심 내용 → 실생활 적용 순서
- 논문 사이에 자연스러운 연결 멘트 포함
- 중간중간 "있잖아", "근데", "그래서" 같은 구어체 사용
- 시작: "안녕! 오늘 논문 브리핑 시작할게."
- 끝: "오늘 브리핑 어땠어? 내일도 재밌는 논문 들고 올게!"
- 마크다운 기호(#, *, -) 없이 텍스트만

논문 카드들:
${cardsText}`
    }]
  })

  return NextResponse.json({ script: (message.content[0] as any).text })
}
