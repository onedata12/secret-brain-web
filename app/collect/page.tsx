'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CollectPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [pct, setPct] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [done, setDone] = useState<{ added: number; errors: string[] } | null>(null)
  const [stats, setStats] = useState({ cards: 0, pending: 0, approved: 0 })

  const loadStats = async () => {
    const [all, pending, approved] = await Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/cards?status=pending').then(r => r.json()),
      fetch('/api/cards?status=approved').then(r => r.json()),
    ])
    setStats({ cards: all.length, pending: pending.length, approved: approved.length })
  }

  useEffect(() => { loadStats() }, [])

  const search = async () => {
    if (!query.trim() || loading) return
    setLoading(true)
    setPct(0)
    setLogs([])
    setDone(null)

    const res = await fetch('/api/search-collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break

      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (typeof data.pct === 'number') setPct(data.pct)
          if (data.msg) setLogs(prev => [...prev, data.msg])
          if (data.done) {
            setDone({ added: data.added ?? 0, errors: data.errors ?? [] })
            if (data.added > 0) loadStats()
          }
        } catch {}
      }
    }

    setLoading(false)
  }

  const EXAMPLES = [
    '아침에 일어나기 힘든 이유',
    '운동을 꾸준히 못 하는 이유',
    '스마트폰 중독 극복',
    '수면이 기억력에 미치는 영향',
    '스트레스 줄이는 법',
    '집중력 높이는 방법',
    '좋은 습관 만드는 법',
    '생산성 높이는 법',
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

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => setQuery(e)}
              className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2.5 py-1 rounded-full transition-colors">
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* 진행 상황 */}
      {(loading || logs.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 space-y-3">
          {/* 프로그레스바 */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>진행 중...</span>
              <span className="font-medium text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div
                className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* 로그 */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {logs.map((l, i) => (
              <p key={i} className={`text-xs font-mono ${
                l.startsWith('⚠️') || l.startsWith('❌') ? 'text-red-500'
                : l.startsWith('✅') || l.startsWith('🎉') ? 'text-green-600'
                : 'text-slate-500'
              }`}>{l}</p>
            ))}
          </div>

          {/* 완료 결과 */}
          {done && (
            <div className={`pt-3 border-t border-slate-100 flex items-center justify-between`}>
              {done.added > 0 ? (
                <>
                  <p className="text-sm font-semibold text-green-700">
                    ✅ {done.added}개 카드가 검토 대기에 추가됐어요!
                  </p>
                  <button
                    onClick={() => router.push('/review')}
                    className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                  >
                    검토하러 가기 →
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">새 논문을 찾지 못했어요. 다른 검색어를 시도해보세요.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 자동 수집 안내 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          🕐 <strong>자동 수집</strong>: 주제를 추가해두면 매일 자동으로 논문을 수집해요.
          <a href="/topics" className="text-indigo-500 hover:underline ml-1">주제 관리 →</a>
        </p>
      </div>
    </div>
  )
}
