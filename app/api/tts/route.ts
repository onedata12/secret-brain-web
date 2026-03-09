import { NextResponse } from 'next/server'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

export async function POST(req: Request) {
  const body = await req.json()
  const text: string = body.text || ''
  if (!text) return NextResponse.json({ error: '텍스트 없음' }, { status: 400 })

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata('ko-KR-SunHiNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)

    const chunks: Buffer[] = []
    const { audioStream } = tts.toStream(text)

    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk))
      audioStream.on('end', resolve)
      audioStream.on('error', reject)
    })

    const audio = Buffer.concat(chunks)
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
