import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key || url === 'your_supabase_url') {
      throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop]
  }
})

export type Topic = {
  id: number
  name: string
  query: string
  active: boolean
  created_at: string
}

export type Paper = {
  id: string
  title: string
  abstract: string
  year: number
  authors: string[]
  citation_count: number
  evidence_level: string
  trust_score: number
  search_topic: string
  doi_url: string | null
  pdf_url: string | null
  status: string
  collected_at: string
}

export type Card = {
  id: string
  topic: string
  evidence_level: string
  paper_title: string
  year: number
  citations: number
  authors: string[]
  status: 'pending' | 'approved' | 'rejected'
  headline: string
  one_line: string
  easy_explanation: string
  why_important: string
  secret_brain_insight: string
  sns_copy: string
  landing_copy: string
  keywords: string[]
  doi_url: string | null
  pdf_url: string | null
  abstract_text: string
  review_log: string[]
  generated_at: string
  reviewed_at: string | null
}
