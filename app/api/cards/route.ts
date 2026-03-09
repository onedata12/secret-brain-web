import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase.from('cards').select('*').order('generated_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const body = await req.json()

  // 일괄 처리: { ids: string[], status: string }
  if (body.ids) {
    const updates: any = { status: body.status, reviewed_at: new Date().toISOString() }
    const { error } = await supabase.from('cards').update(updates).in('id', body.ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: body.ids.length })
  }

  // 단건: { id, status }
  const { id, status, review_log } = body
  const updates: any = { status, reviewed_at: new Date().toISOString() }
  if (review_log) updates.review_log = review_log
  const { data, error } = await supabase.from('cards').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const body = await req.json()

  // 일괄 삭제: { ids: string[] }
  if (body.ids) {
    const { error } = await supabase.from('cards').delete().in('id', body.ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: body.ids.length })
  }

  // 단건: { id }
  const { error } = await supabase.from('cards').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
