import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { card } = await req.json()
  if (!card) return NextResponse.json({ error: '카드 없음' }, { status: 400 })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `너는 "시크릿 브레인 라디오"의 진행자야. 운동하면서 이어폰으로 듣기 좋은 논문 해설 팟캐스트를 만들어줘.

논문 정보:
- 제목: ${card.paper_title}
- 주제: ${card.topic}
- 연도: ${card.year}년
- 인용 수: ${card.citations}회
- 근거 수준: ${card.evidence_level}
- 핵심: ${card.one_line}
- 쉬운 설명: ${card.easy_explanation}
- 중요성: ${card.why_important}
- 시크릿 브레인 인사이트: ${card.secret_brain_insight}
- 초록: ${card.abstract_text}

조건:
- 15분 분량 (약 3500~4000자)
- 혼자 진행하는 라디오 토크쇼 형식
- 친한 선배가 후배한테 얘기하듯 반말, 자연스러운 구어체
- "있잖아", "근데 말이야", "그래서", "진짜 재밌는 게", "아 그리고" 같은 연결 표현 자주 사용
- 마크다운 기호(#, *, -, 번호) 절대 쓰지 마. 순수 텍스트만.
- 이모지 쓰지 마.

구성:
1. 인트로 (30초): "안녕! 시크릿 브레인 라디오에 온 걸 환영해. 오늘은 진짜 흥미로운 논문 하나 가져왔어." 같은 오프닝
2. 논문 소개 (2분): 이 논문이 뭔지, 왜 관심을 가져야 하는지
3. 핵심 내용 깊이 파기 (5분): 연구 방법, 결과, 숫자/통계를 재밌게 풀어서 설명. 비유 많이 써.
4. 왜 중요한지 (3분): 일상생활, 직장, 인간관계에 어떤 영향?
5. 실전 적용법 (3분): "자 그러면 우리가 뭘 할 수 있냐면" 식으로 구체적 행동 팁 3~5개
6. 시크릿 브레인 연결 (1분): 할 일 관리, 시간 주도권과 연결
7. 마무리 (30초): "오늘 내용 어땠어? ... 다음에 또 재밌는 거 들고 올게. 운동 마저 화이팅!"

자연스러운 호흡으로 써줘. 문단 사이에 빈 줄 넣어서 읽기 쉽게.`
    }]
  })

  const script = (message.content[0] as any).text.trim()
  return NextResponse.json({ script })
}
