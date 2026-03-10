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

  // 검색 상태
  const [searching, setSearching] = useState(false)
  const [foundPapers, setFoundPapers] = useState<PaperItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchPhaseQuery, setSearchPhaseQuery] = useState('')
  const [searchError, setSearchError] = useState('')
  const [searchQueryEn, setSearchQueryEn] = useState('')  // 영문 검색어 보존
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // 딥스캔 상태
  const [deepScanning, setDeepScanning] = useState(false)
  const [deepPct, setDeepPct] = useState(0)
  const [deepLogs, setDeepLogs] = useState<string[]>([])
  const [deepStats, setDeepStats] = useState<any>(null)
  const [deepAbortRef] = useState<{ current: AbortController | null }>({ current: null })

  // 정렬 상태
  const [sortBy, setSortBy] = useState<'trust' | 'citations' | 'year_desc' | 'year_asc'>('trust')

  // 카드 생성 ETA
  const [cardStartTime, setCardStartTime] = useState(0)

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

  // 논문 검색
  const handleSearch = async () => {
    if (!query.trim() || searching || running) return
    setSearching(true)
    setFoundPapers([])
    setSelectedIds(new Set())
    setSearchError('')
    setSearchPhaseQuery(query)
    setNextCursor(null)
    setSearchQueryEn('')

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
    setSelectedIds(new Set(papers.filter(p => p.recommended).map(p => p.paperId)))
    setSearchQueryEn(data.searchQuery || '')
    setNextCursor(data.nextCursor || null)
    setTotalCount(data.totalCount || 0)
  }

  // 더 불러오기
  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)

    const res = await fetch('/api/search-papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchPhaseQuery, cursor: nextCursor, searchQuery: searchQueryEn }),
    })
    const data = await res.json()
    setLoadingMore(false)

    if (data.error) return
    const newPapers: PaperItem[] = data.papers || []
    const existingIds = new Set(foundPapers.map(p => p.paperId))
    const uniqueNew = newPapers.filter(p => !existingIds.has(p.paperId))
    setFoundPapers(prev => [...prev, ...uniqueNew])
    setNextCursor(data.nextCursor || null)
  }

  // 딥스캔
  const handleDeepScan = async () => {
    if (deepScanning || !query.trim()) return
    setDeepScanning(true)
    setDeepPct(0)
    setDeepLogs([])
    setDeepStats(null)
    setFoundPapers([])
    setSelectedIds(new Set())

    const controller = new AbortController()
    deepAbortRef.current = controller

    try {
      const res = await fetch('/api/deep-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: query }),
        signal: controller.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let receivedPapers: any[] = []

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (typeof data.pct === 'number') setDeepPct(data.pct)
            if (data.msg) setDeepLogs(prev => [...prev, data.msg])
            if (data.papers) {
              receivedPapers = data.papers
              setFoundPapers(data.papers)
              setSelectedIds(new Set(data.papers.filter((p: any) => p.recommended).map((p: any) => p.paperId)))
            }
            if (data.stats) setDeepStats(data.stats)
          } catch {}
        }
      }

      // 딥스캔 완료 후 제목 번역
      if (receivedPapers.length > 0) {
        setDeepLogs(prev => [...prev, '🌐 논문 제목 번역 중...'])
        try {
          const titlesToTranslate = receivedPapers.filter((p: any) => !p.titleKo && p.titleEn)
          if (titlesToTranslate.length > 0) {
            const batchSize = 25
            for (let i = 0; i < titlesToTranslate.length; i += batchSize) {
              const batch = titlesToTranslate.slice(i, i + batchSize)
              const res = await fetch('/api/translate-titles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titles: batch.map((p: any) => p.titleEn) }),
              })
              const { translations } = await res.json()
              if (translations?.length) {
                const idToKo = new Map<string, string>()
                batch.forEach((p: any, idx: number) => {
                  if (translations[idx]) idToKo.set(p.paperId, translations[idx])
                })
                receivedPapers = receivedPapers.map((p: any) => idToKo.has(p.paperId) ? { ...p, titleKo: idToKo.get(p.paperId) } : p)
                setFoundPapers([...receivedPapers])
              }
            }
            setDeepLogs(prev => [...prev, '✅ 제목 번역 완료!'])
          }
        } catch {
          setDeepLogs(prev => [...prev, '⚠️ 제목 번역 일부 실패'])
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setDeepLogs(prev => [...prev, '⏹ 딥스캔이 중단됐어요.'])
      } else {
        setDeepLogs(prev => [...prev, `❌ 오류: ${e.message}`])
      }
    }
    deepAbortRef.current = null
    setDeepScanning(false)
  }

  const handleDeepScanAbort = () => {
    deepAbortRef.current?.abort()
  }

  // 카드 생성
  const handleGenerate = () => {
    const selected = foundPapers.filter(p => selectedIds.has(p.paperId))
    if (!selected.length || running) return
    setCardStartTime(Date.now())
    start(searchPhaseQuery || query, selected)
  }

  // 정렬된 논문 목록
  const sortedPapers = [...foundPapers].sort((a, b) => {
    switch (sortBy) {
      case 'citations': return b.citations - a.citations
      case 'year_desc': return b.year - a.year
      case 'year_asc': return a.year - b.year
      default: return 0 // trust: 기본 서버 정렬 유지
    }
  })

  const togglePaper = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const selectAll = () => setSelectedIds(new Set(foundPapers.map(p => p.paperId)))
  const selectNone = () => setSelectedIds(new Set())
  const selectRecommended = () => setSelectedIds(new Set(foundPapers.filter(p => p.recommended).map(p => p.paperId)))

  const deleteLog = (id: string) => { const h = loadHistory().filter(l => l.id !== id); localStorage.setItem('search_history', JSON.stringify(h)); setHistory(h) }
  const clearHistory = () => { localStorage.removeItem('search_history'); setHistory([]) }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold mb-1">🔍 논문 검색</h1>
        <p className="text-slate-400 text-sm">궁금한 걸 입력하면 관련 논문을 찾아줘요</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        {[{ label: '전체 카드', value: stats.cards }, { label: '검토 대기', value: stats.pending }, { label: '승인 완료', value: stats.approved }].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-indigo-500">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 검색창 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
        <label className="text-sm font-medium text-slate-700 mb-2 block">뭐가 궁금해?</label>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            disabled={searching || running || deepScanning}
            placeholder="예: 운동하면 뇌가 좋아진다는 게 사실이야?"
            className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60" />
          <button onClick={handleSearch} disabled={searching || running || deepScanning || !query.trim()}
            className="shrink-0 bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation">
            {searching ? '검색 중...' : '검색'}
          </button>
        </div>

        {/* 딥스캔 버튼 */}
        <div className="mt-2 flex items-center gap-2">
          <button onClick={handleDeepScan} disabled={searching || running || deepScanning || !query.trim()}
            className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg active:bg-purple-100 disabled:opacity-40 font-medium touch-manipulation">
            {deepScanning ? '스캔 중...' : '🔬 딥스캔 (100+개 논문 탐색)'}
          </button>
          <span className="text-xs text-slate-400">한 분야를 깊이 파고들고 싶을 때</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => setQuery(e)} disabled={searching || running || deepScanning}
              className="text-xs bg-slate-50 active:bg-indigo-50 active:text-indigo-700 text-slate-500 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 border border-slate-100">
              {e}
            </button>
          ))}
        </div>
        {searchError && <p className="mt-2 text-xs text-red-500">⚠️ {searchError}</p>}
      </div>

      {/* 딥스캔 진행 */}
      {(deepScanning || deepStats) && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-purple-800">🔬 딥스캔 {deepScanning ? '진행 중...' : '완료'}</p>
            {deepScanning && (
              <button onClick={handleDeepScanAbort}
                className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg touch-manipulation">중단</button>
            )}
          </div>
          <div className="w-full bg-purple-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full bg-purple-500 progress-bar" style={{ width: `${deepPct}%` }} />
          </div>
          {deepStats && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-purple-600">{deepStats.total}</p>
                <p className="text-xs text-slate-400">전체 논문</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-amber-600">{deepStats.metaAnalyses + deepStats.systematicReviews}</p>
                <p className="text-xs text-slate-400">메타분석/리뷰</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{deepStats.highCitation}</p>
                <p className="text-xs text-slate-400">인용 100+</p>
              </div>
            </div>
          )}
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {deepLogs.slice(-8).map((l, i) => (
              <p key={i} className={`text-xs ${l.includes('✅') || l.includes('🎉') ? 'text-green-600' : l.includes('⚠️') || l.includes('❌') ? 'text-red-500' : 'text-purple-600'}`}>{l}</p>
            ))}
          </div>
        </div>
      )}

      {/* 논문 목록 + 선택 */}
      {foundPapers.length > 0 && !running && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-sm">📄 발견된 논문 ({foundPapers.length}개{totalCount > foundPapers.length ? ` / 전체 ${totalCount.toLocaleString()}개` : ''})</h2>
              <p className="text-xs text-slate-400 mt-0.5">카드로 만들 논문을 선택하세요</p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <button onClick={selectRecommended} className="text-xs text-amber-600 active:underline touch-manipulation">⭐ 추천만</button>
              <button onClick={selectAll} className="text-xs text-indigo-500 active:underline touch-manipulation">전체 선택</button>
              <button onClick={selectNone} className="text-xs text-slate-400 active:underline touch-manipulation">전체 해제</button>
            </div>
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-xs text-slate-400">정렬:</span>
            {([
              ['trust', '🏆 신뢰도순'],
              ['citations', '📊 인용수순'],
              ['year_desc', '📅 최신순'],
              ['year_asc', '📅 오래된순'],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  sortBy === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 active:bg-slate-200'
                }`}>{label}</button>
            ))}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {sortedPapers.map(p => (
              <label key={p.paperId} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedIds.has(p.paperId) ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 active:bg-slate-100'
              }`}>
                <input type="checkbox" checked={selectedIds.has(p.paperId)}
                  onChange={() => togglePaper(p.paperId)}
                  className="mt-1 w-4 h-4 accent-indigo-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{p.titleKo || p.titleEn}</p>
                    {p.recommended && (
                      <span className="shrink-0 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⭐ 추천</span>
                    )}
                  </div>
                  {p.titleEn && p.titleKo && (
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{p.titleEn}</p>
                  )}
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
                        className="text-xs text-indigo-400 active:underline">원문 →</a>
                    )}
                  </div>
                  {p.abstract && (
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{p.abstract}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* 더 불러오기 */}
          {nextCursor && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <button onClick={handleLoadMore} disabled={loadingMore}
                className="text-sm text-indigo-600 active:text-indigo-800 font-medium disabled:opacity-50 touch-manipulation px-4 py-2">
                {loadingMore ? '불러오는 중...' : `더 불러오기 (현재 ${foundPapers.length}개${totalCount ? ` / ${totalCount.toLocaleString()}개` : ''})`}
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-500">{selectedIds.size}개 선택됨 {selectedIds.size > 5 && <span className="text-amber-500">(한 번에 최대 5개 카드 생성)</span>}</p>
            <button onClick={handleGenerate} disabled={selectedIds.size === 0 || running}
              className="bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors touch-manipulation">
              🤖 선택한 {selectedIds.size}개 카드로 만들기
            </button>
          </div>
        </div>
      )}

      {/* 카드 생성 진행 */}
      {(running || (done && logs.length > 0)) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
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
              <span>{running ? (() => {
                if (pct > 5 && cardStartTime > 0) {
                  const elapsed = (Date.now() - cardStartTime) / 1000
                  const remaining = Math.max(0, Math.round(elapsed / pct * (100 - pct)))
                  if (remaining > 60) return `약 ${Math.ceil(remaining / 60)}분 남음`
                  if (remaining > 0) return `약 ${remaining}초 남음`
                }
                return '진행 중...'
              })() : done?.added ? `${done.added}개 완료` : '완료'}</span>
              <span className="font-semibold text-indigo-600">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className={`h-2 rounded-full progress-bar ${!running ? 'bg-green-500' : 'bg-indigo-500'}`}
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
              <a href="/review" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-xl active:bg-indigo-700">검토하기 →</a>
            </div>
          )}
        </div>
      )}

      {/* 논문 기반 답변 */}
      {answer && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-indigo-500 mb-2">💡 논문 기반 답변 — {runningQuery}</p>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {/* 검색 기록 */}
      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">📋 검색 기록 ({history.length})</h2>
            <button onClick={clearHistory} className="text-xs text-slate-400 active:text-red-400 touch-manipulation">전체 삭제</button>
          </div>
          <div className="space-y-2">
            {history.map(log => (
              <div key={log.id} className="border border-slate-100 rounded-xl overflow-hidden">
                <button onClick={() => setOpenLog(openLog === log.id ? null : log.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 active:bg-slate-50 text-left touch-manipulation">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{log.query}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{log.date} · 카드 {log.cardsAdded}개 추가</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-xs text-slate-300">{openLog === log.id ? '▲' : '▼'}</span>
                    <button onClick={e => { e.stopPropagation(); deleteLog(log.id) }}
                      className="text-xs text-slate-300 active:text-red-400 px-1 touch-manipulation">✕</button>
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

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs text-slate-500">🕐 <strong>자동 수집</strong>: 주제를 추가해두면 매일 자동으로 논문을 수집해요.
          <a href="/topics" className="text-indigo-500 active:underline ml-1">주제 관리 →</a></p>
      </div>
    </div>
  )
}
