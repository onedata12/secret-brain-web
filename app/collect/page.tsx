'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CollectPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<{ added: number; message?: string } | null>(null)
  const [stats, setStats] = useState({ cards: 0, pending: 0, approved: 0 })

  const loadStats = async () => {
    const [all, pending, approved] = await Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/cards?status=pending').then(r => r.json()),
      fetch('/api/cards?status=approved').then(r => r.json()),
    ])
    setStats({
      cards: all.length,
      pending: pending.length,
      approved: approved.length,
    })
  }

  useEffect(() => { loadStats() }, [])

  const search = async () => {
    if (!query.trim() || loading) return
    setLoading(true)
    setLogs([])
    setErrors([])
    setResult(null)

    const res = await fetch('/api/search-collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const data = await res.json()
    setLogs(data.logs || [])
    setErrors(data.errors || [])
    setResult({ added: data.added ?? 0, message: data.message })
    setLoading(false)
    if (data.added > 0) loadStats()
  }

  const EXAMPLES = [
    '아침에 일어나기 힘든 이유가 뭐야?',
    '운동을 꾸준히 못 하는 이유',
    '스마트폰 중독에서 벗어나는 법',
    '수면이 기억력에 미치는 영향',
    '스트레스가 건강에 미치는 영향',
    '집중력을 높이는 방법',
    '좋은 습관 만드는 법',
    '감사일기가 행복에 미치는 효과',
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🔍 논문 검색</h1>
      <p className="text-slate-500 text-sm mb-6">궁금한 걸 입력하면 관련 논문 인사이트 카드를 만들어줘요</p>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '전체 카드', value: stats.cards },
          { label: '검토 대기', value: stats.pending },
          { label: '승인 완료', value: stats.approved },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-500">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 검색 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <label className="text-sm font-medium text-slate-700 mb-2 block">뭐가 궁금해?</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="예: 운동하면 뇌가 좋아진다는 게 사실이야?"
            className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? '검색 중...' : '논문 찾기'}
          </button>
        </div>

        {/* 예시 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => setQuery(e)}
              className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2.5 py-1 rounded-full transition-colors">
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* 진행 로그 */}
      {(loading || logs.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <div className="space-y-1.5">
            {logs.map((l, i) => (
              <p key={i} className="text-sm text-slate-600 font-mono">{l}</p>
            ))}
            {loading && (
              <p className="text-sm text-slate-400 animate-pulse">⏳ 처리 중... (약 30초 소요)</p>
            )}
          </div>

          {/* 에러 */}
          {errors.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500 font-mono">⚠️ {e}</p>
              ))}
            </div>
          )}

          {/* 결과 */}
          {result && !loading && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              {result.added > 0 ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-700">
                    ✅ {result.added}개 카드가 검토 대기에 추가됐어요!
                  </p>
                  <button
                    onClick={() => router.push('/review')}
                    className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                  >
                    검토하러 가기 →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {result.message || '새로운 논문을 찾지 못했어요. 다른 질문을 입력해보세요.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 자동 수집 안내 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          🕐 <strong>자동 수집</strong>: 주제 관리에서 주제를 추가해두면 매일 자동으로 논문을 수집해요.
          <a href="/topics" className="text-indigo-500 hover:underline ml-1">주제 관리 →</a>
        </p>
      </div>
    </div>
  )
}
