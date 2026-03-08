import { NextResponse } from 'next/server'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateNarration(card: Record<string, unknown>): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `당신은 운동하면서 들을 수 있는 흥미롭고 유익한 오디오 나레이션을 만드는 전문가입니다.

아래 논문 카드 정보를 바탕으로 약 10분 분량(2000~2500자)의 한국어 나레이션 스크립트를 작성하세요.

[논문 카드 정보]
제목: ${card.headline}
핵심 한 줄: ${card.one_line}
주제: ${card.topic}
근거 수준: ${card.evidence_level}
인용 횟수: ${card.citations}회 (${card.year}년)
쉬운 설명: ${card.easy_explanation}
왜 중요한가: ${card.why_important}
시크릿 브레인 인사이트: ${card.secret_brain_insight}
SNS 문구: ${card.sns_copy}

[작성 구조 - 자연스러운 대화체로]
1. 도입부 (30초): 흥미를 끄는 질문이나 상황으로 시작
2. 연구 배경 (2분): 이 연구가 왜 진행됐는지, 우리 일상과 어떻게 연결되는지
3. 연구 방법과 규모 (2분): 어떻게 연구했는지, 얼마나 믿을 수 있는지
4. 핵심 발견 (2분): 무엇을 발견했는지 구체적으로
5. 실생활 적용법 (2분): 오늘부터 바로 적용할 수 있는 방법 3가지
6. 시크릿 브레인 인사이트 (1분): 이 연구가 삶을 주도하는 것과 어떻게 연결되는지
7. 마무리 (30초): 핵심 메시지 한 번 더

- 헤더(###), 줄표(-) 없이 순수 텍스트로만 작성
- 친근하고 생동감 있는 말투
- 운동 중에 들어도 귀에 쏙 들어오도록
- 다음에 바로 이어서 읽을 수 있도록 자연스럽게 연결`
    }]
  })
  return (msg.content[0] as { text: string }).text
}

async function textToAudio(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS()
  await tts.setMetadata('ko-KR-SunHiNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
  const chunks: Buffer[] = []
  const { audioStream } = tts.toStream(text)
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    audioStream.on('end', resolve)
    audioStream.on('error', reject)
  })
  return Buffer.concat(chunks)
}

export async function POST(req: Request) {
  const body = await req.json()

  try {
    let textToSpeak: string
    if (body.card) {
      textToSpeak = await generateNarration(body.card)
    } else {
      textToSpeak = body.text
    }

    const audio = await textToAudio(textToSpeak)
    return new NextResponse(audio as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.length),
      }
    })
  } catch (e) {
    console.error('TTS error:', e)
    return NextResponse.json({ error: 'TTS 생성 실패' }, { status: 500 })
  }
}
