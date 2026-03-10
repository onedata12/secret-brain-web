'use client'
import { useEffect, useState } from 'react'
import { useCollect, PaperItem } from '@/context/CollectContext'

type SearchLog = { id: string; query: string; answer: string; cardsAdded: number; date: string }
function loadHistory(): SearchLog[] { try { return JSON.parse(localStorage.getItem('search_history') || '[]') } catch { return [] } }
function saveLog(log: SearchLog) { const h = loadHistory(); h.unshift(log); localStorage.setItem('search_history', JSON.stringify(h.slice(0, 50))) }

const EXAMPLES = ['생산성 높이는 법', '좋은 습관 만드는 법', '수면이 기억력에 미치는 영향', '집중력 높이는 방법', '스트레스 줄이는 법', '운동과 뇌', '동기부여', '번아웃 극복']

export default function CollectPage() {
  const { running, pct, logs, answer, papers: genPapers, done, query: runningQuery, start, abort } = useCollect()
  const [query, setQuery] = useState('')
  const [stats, setStats] = useState({ cards: 0, pending: 0, approved: 0 })
  const [history, setHistory] = useState<SearchLog[]>([])
  const [openLog, setOpenLog] = useState<string | null>(null)
  const [savedThisRun, setSavedThisRun] = useState(false)

  // 검색 1단계 상태
  const [searching, setSearching] = useState(false)
  const [foundPapers, setFoundPapers] = useState<PaperItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchPhaseQuery, setSearchPhaseQuery] = useState('')
  const [searchError, setSearchError] = useState('')

  const loadStats = async () => {
    const [all, pending, approved] = await Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/cards?status=pending').then(r => r.json()),
      fetch('/api/cards?status=approved').then(r => r.json()),
    ])
    setStats({ cards: all.length, pending: pending.length, approved: approved.length })
  }

  useEffect(() => { loadStats(); setHistory(loadHistory()) }, [])

  useEffect(() => {
    if (done && !savedThisRun && runningQuery) {
      saveLog({ id: Date.now().toString(), query: runningQuery, answer, cardsAdded: done.added, date: new Date().toLocaleString('ko-KR') })
      setHistory(loadHistory())
      setSavedThisRun(true)
      if (done.added > 0) { loadStats(); setFoundPapers([]) }
    }
    if (!done) setSavedThisRun(false)
  }, [done, runningQuery, answer, savedThisRun])

  // 1단계: 논문 검색 (카드 생성 없이)
  const handleSearch = async () => {
    if (!query.trim() || searching || running) return
    setSearching(true)
    setFoundPapers([])
    setSelectedIds(new Set())
    setSearchError('')
    setSearchPhaseQuery(query)

    const res = await fetch('/api/search-papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const data = await res.json()
    setSearching(false)

    if (data.error) { setSearchError(data.error); return }
    const papers: PaperItem[] = data.papers || []
    setFoundPapers(papers)
    // 추천 논문 자동 선택
    setSelectedIds(new Set(papers.filter(p => p.recommended).map(p => p.paperId)))
  }

  // 2단계: 선택한 논문으로 카드 생성
  const handleGenerate = () => {
    const selected = foundPapers.filter(p => selectedIds.has(p.paperId))
    if (!selected.length || running) return
    start(searchPhaseQuery, selected)
  }

  const togglePaper = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const selectAll = () => setSelectedIds(new Set(foundPapers.map(p => p.paperId)))
  const selectNone = () => setSelectedIds(new Set())

  const deleteLog = (id: string) => { const h = loadHistory().filter(l => l.id !== id); localStorage.setItem('search_history', JSON.stringify(h)); setHistory(h) }
  const clearHistory = () => { localStorage.removeItem('search_history'); setHistory([]) }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">🔍 논문 검색</h1>
        <p className="text-slate-500 text-sm">궁금한 걸 입력하면 관련 논문을 찾아줘요</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        {[{ label: '전체 카드', value: stats.cards }, { label: '검토 대기', value: stats.pending }, { label: '승인 완료', value: stats.approved }].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-500">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 검색창 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
        <label className="text-sm font-medium text-slate-700 mb-2 block">뭐가 궁금해?</label>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            disabled={searching || running}
            placeholder="예: 운동하면 뇌가 좋아진다는 게 사실이야?"
            className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60" />
          <button onClick={handleSearch} disabled={searching || running || !query.trim()}
            className="shrink-0 bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation">
            {searching ? '검색 중...' : '논문 찾기'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => setQuery(e)} disabled={searching || running}
              className="text-xs bg-slate-50 active:bg-indigo-50 active:text-indigo-700 text-slate-500 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 border border-slate-100">
              {e}
            </button>
          ))}
        </div>
        {searchError && <p className="mt-2 text-xs text-red-500">⚠️ {searchError}</p>}
      </div>

      {/* 1단계: 논문 목록 + 선택 */}
      {foundPapers.length > 0 && !running && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-sm">📄 발견된 논문 ({foundPapers.length}개)</h2>
              <p className="text-xs text-slate-400 mt-0.5">카드로 만들 논문을 선택하세요. ⭐ 추천 논문은 자동 선택됩니다.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={selectAll} className="text-xs text-indigo-500 hover:underline">전체 선택</button>
              <button onClick={selectNone} className="text-xs text-slate-400 hover:underline">전체 해제</button>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {foundPapers.map(p => (
              <label key={p.paperId} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedIds.has(p.paperId) ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input type="checkbox" checked={selectedIds.has(p.paperId)}
                  onChange={() => togglePaper(p.paperId)}
                  className="mt-1 w-4 h-4 accent-indigo-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{p.titleKo}</p>
                    {p.recommended && (
                      <span className="shrink-0 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⭐ 추천</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">{p.titleEn}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-500">{p.year}년</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-indigo-600 font-medium">{p.evidenceLevel}</span>
                    {p.citations > 0 && <>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-500">인용 {p.citations.toLocaleString()}회</span>
                    </>}
                    {p.reasons?.length > 0 && (
                      <span className="text-xs text-slate-400">· {p.reasons.join(' · ')}</span>
                    )}
                    {p.doiUrl && (
                      <a href={p.doiUrl} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-indigo-400 hover:underline">원문 →</a>
                    )}
                  </div>
                  {p.abstract && (
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{p.abstract}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">{selectedIds.size}개 선택됨</p>
            <button onClick={handleGenerate} disabled={selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
              🤖 선택한 {selectedIds.size}개 카드로 만들기
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 카드 생성 진행 */}
      {(running || (done && logs.length > 0)) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">{running ? '카드 생성 중...' : '완료'}</p>
            {running && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); abort() }}
                className="text-xs bg-red-500 text-white active:bg-red-600 px-3 py-1.5 rounded-lg font-medium min-w-[60px] touch-manipulation">
                중단
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{running ? '진행 중...' : done?.added ? `${done.added}개 완료` : '완료'}</span>
              <span className="font-semibold text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className={`h-2.5 rounded-full transition-all duration-500 ${!running ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {logs.map((l, i) => (
              <p key={i} className={`text-xs font-mono ${
                l.startsWith('⚠️') || l.startsWith('❌') ? 'text-red-500'
                : l.startsWith('✅') || l.startsWith('🎉') ? 'text-green-600'
                : l.startsWith('🤖') ? 'text-indigo-500' : 'text-slate-400'
              }`}>{l}</p>
            ))}
            {running && <p className="text-xs text-slate-300 animate-pulse">▋</p>}
          </div>
          {done && !running && done.added > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-green-700">✅ {done.added}개 카드가 검토 대기에 추가됐어요!</p>
              <a href="/review" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">검토하러 가기 →</a>
            </div>
          )}
        </div>
      )}

      {/* 논문 기반 답변 */}
      {answer && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-indigo-500 mb-2">💡 논문 기반 답변 — {runningQuery}</p>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {/* 검색 기록 */}
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
        <p className="text-xs text-slate-500">🕐 <strong>자동 수집</strong>: 주제를 추가해두면 매일 자동으로 논문을 수집해요.
          <a href="/topics" className="text-indigo-500 hover:underline ml-1">주제 관리 →</a></p>
      </div>
    </div>
  )
}
