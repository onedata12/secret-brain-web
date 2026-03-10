import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'card-cache'

// GET: 카드 캐시 조회
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get('cardId')
  const type = searchParams.get('type') // 'deep' | 'translation' | 'chat'

  if (!cardId || !type) return Response.json({ error: 'Missing params' }, { status: 400 })

  const path = `${cardId}/${type}.json`
  const { data, error } = await supabase.storage.from(BUCKET).download(path)

  if (error || !data) return Response.json({ data: null })

  const text = await data.text()
  try {
    return Response.json({ data: JSON.parse(text) })
  } catch {
    return Response.json({ data: text })
  }
}

// POST: 카드 캐시 저장
export async function POST(req: Request) {
  const { cardId, type, content } = await req.json()

  if (!cardId || !type || content === undefined) {
    return Response.json({ error: 'Missing params' }, { status: 400 })
  }

  const path = `${cardId}/${type}.json`
  const body = typeof content === 'string' ? content : JSON.stringify(content)
  const blob = new Blob([body], { type: 'application/json' })

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'application/json',
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
