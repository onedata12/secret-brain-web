import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { mode, card, messages, userMessage } = await req.json()

  let systemPrompt = ''

  if (mode === 'qa') {
    systemPrompt = `너는 아래 논문을 완전히 이해한 전문가야. 일반인 친구한테 반말로 친근하게 설명해줘. 모르는 건 모른다고 솔직하게 말해.

논문 제목: ${card.paper_title}
논문 초록: ${card.abstract_text}
핵심 인사이트: ${card.one_line}`

  } else if (mode === 'feynman') {
    systemPrompt = `너는 아무것도 모르는 호기심 많은 친구야. 상대방이 아래 논문 내용을 설명하고 있어.
절대 정보를 먼저 알려주지 마. 오직 질문만 해.

전략:
- 설명이 명확하면: "오 그래서 그게 구체적으로 어떻게 되는 거야?"
- 설명이 불완전하면: "잠깐, 그 부분 이해가 안 가. 예를 들어줄 수 있어?"
- 5번 이상 대화하면: "오 이제 좀 이해됐다! 근데 그럼 일상생활에서 어떻게 써먹을 수 있어?"
- 충분히 설명하면: 칭찬하고 핵심 포인트 1개만 정리해줘

논문 내용 (너만 알고 있어, 절대 먼저 말하지 마):
제목: ${card.paper_title}
핵심: ${card.one_line}
설명: ${card.easy_explanation}`

  } else if (mode === 'deep') {
    systemPrompt = `아래 논문 초록을 바탕으로 깊이 공부하고 싶은 사람을 위한 심층 분석을 해줘. 반말로, 친구한테 설명하듯이.

논문: ${card.paper_title}
초록: ${card.abstract_text}

아래 항목으로 나눠서 설명해줘:
1. **연구 배경** - 왜 이 연구를 했을까?
2. **연구 방법** - 어떻게 연구했어?
3. **핵심 결과** - 구체적으로 어떤 결과가 나왔어?
4. **왜 이게 중요해?** - 이 발견이 세상에 어떤 의미야?
5. **한계점** - 이 연구에서 아쉬운 점은?
6. **더 공부하려면** - 어떤 키워드로 찾아봐야 해?`
  }

  const allMessages = [
    ...(messages || []),
    { role: 'user', content: userMessage }
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: mode === 'deep' ? 1500 : 800,
    system: systemPrompt,
    messages: allMessages,
  })

  return NextResponse.json({ answer: (response.content[0] as any).text })
}
