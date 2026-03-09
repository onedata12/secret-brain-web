'use client'
import { useEffect, useState } from 'react'
import { useCollect } from '@/context/CollectContext'

type SearchLog = {
  id: string
  query: string
  answer: string
  cardsAdded: number
  date: string
}

function loadHistory(): SearchLog[] {
  try { return JSON.parse(localStorage.getItem('search_history') || '[]') }
  catch { return [] }
}

function saveLog(log: SearchLog) {
  const h = loadHistory()
  h.unshift(log)
  localStorage.setItem('search_history', JSON.stringify(h.slice(0, 50)))
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

export default function CollectPage() {
  const { running, pct, logs, answer, done, query: runningQuery, start } = useCollect()
  const [query, setQuery] = useState('')
  const [stats, setStats] = useState({ cards: 0, pending: 0, approved: 0 })
  const [history, setHistory] = useState<SearchLog[]>([])
  const [openLog, setOpenLog] = useState<string | null>(null)
  const [savedThisRun, setSavedThisRun] = useState(false)

  const loadStats = async () => {
    const [all, pending, approved] = await Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/cards?status=pending').then(r => r.json()),
      fetch('/api/cards?status=approved').then(r => r.json()),
    ])
    setStats({ cards: all.length, pending: pending.length, approved: approved.length })
  }

  useEffect(() => { loadStats(); setHistory(loadHistory()) }, [])

  // 수집 완료 시 히스토리 저장
  useEffect(() => {
    if (done && !savedThisRun && runningQuery) {
      const log: SearchLog = {
        id: Date.now().toString(),
        query: runningQuery,
        answer,
        cardsAdded: done.added,
        date: new Date().toLocaleString('ko-KR'),
      }
      saveLog(log)
      setHistory(loadHistory())
      setSavedThisRun(true)
      if (done.added > 0) loadStats()
    }
    if (!done) setSavedThisRun(false)
  }, [done, runningQuery, answer, savedThisRun])

  const handleSearch = () => {
    if (!query.trim() || running) return
    start(query)
    setQuery('')
  }

  const deleteLog = (id: string) => {
    const h = loadHistory().filter(l => l.id !== id)
    localStorage.setItem('search_history', JSON.stringify(h))
    setHistory(h)
  }

  const clearHistory = () => {
    localStorage.removeItem('search_history')
    setHistory([])
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">🔍 논문 검색</h1>
        <p className="text-slate-500 text-sm">궁금한 걸 입력하면 관련 논문 인사이트 카드를 만들어줘요</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
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
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <label className="text-sm font-medium text-slate-700 mb-2 block">뭐가 궁금해?</label>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            disabled={running}
            placeholder={running ? `"${runningQuery}" 수집 중... 다른 페이지로 이동해도 계속 진행됩니다` : '예: 운동하면 뇌가 좋아진다는 게 사실이야?'}
            className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
          />
          <button onClick={handleSearch} disabled={running || !query.trim()}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            {running ? '수집 중...' : '논문 찾기'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => setQuery(e)} disabled={running}
              className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2.5 py-1 rounded-full transition-colors disabled:opacity-40">
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* 현재 진행 중인 수집 상황 (이 페이지에 있을 때만) */}
      {(running || (done && logs.length > 0)) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{running ? '진행 중...' : '완료'}</span>
              <span className="font-semibold text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className={`h-2.5 rounded-full transition-all duration-500 ${!running ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {logs.map((l, i) => (
              <p key={i} className={`text-xs font-mono ${
                l.startsWith('⚠️') || l.startsWith('❌') ? 'text-red-500'
                : l.startsWith('✅') || l.startsWith('🎉') ? 'text-green-600'
                : l.startsWith('🤖') ? 'text-indigo-500'
                : 'text-slate-400'
              }`}>{l}</p>
            ))}
            {running && <p className="text-xs text-slate-300 animate-pulse">▋</p>}
          </div>
        </div>
      )}

      {/* 논문 기반 답변 */}
      {answer && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-indigo-500 mb-2">💡 논문 기반 답변 — {runningQuery}</p>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {/* 검색 히스토리 */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">📋 검색 기록 ({history.length})</h2>
            <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-red-400">전체 삭제</button>
          </div>
          <div className="space-y-2">
            {history.map(log => (
              <div key={log.id} className="border border-slate-100 rounded-lg overflow-hidden">
                <button onClick={() => setOpenLog(openLog === log.id ? null : log.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{log.query}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{log.date} · 카드 {log.cardsAdded}개 추가</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-xs text-slate-300">{openLog === log.id ? '▲' : '▼'}</span>
                    <button onClick={e => { e.stopPropagation(); deleteLog(log.id) }}
                      className="text-xs text-slate-300 hover:text-red-400 px-1">✕</button>
                  </div>
                </button>
                {openLog === log.id && log.answer && (
                  <div className="px-3 pb-3 border-t border-slate-100 pt-2">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{log.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          🕐 <strong>자동 수집</strong>: 주제를 추가해두면 매일 자동으로 논문을 수집해요.
          <a href="/topics" className="text-indigo-500 hover:underline ml-1">주제 관리 →</a>
        </p>
      </div>
    </div>
  )
}
