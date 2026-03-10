'use client'
import { useEffect, useState } from 'react'
import type { Topic } from '@/lib/supabase'

const EXAMPLES = [
  { name: '습관 형성', query: 'habit formation behavior change meta-analysis' },
  { name: '수면과 성과', query: 'sleep quality performance productivity meta-analysis' },
  { name: '운동과 뇌', query: 'exercise cognitive function brain meta-analysis' },
  { name: '마음챙김', query: 'mindfulness anxiety stress systematic review' },
  { name: '번아웃', query: 'burnout prevention workplace systematic review' },
  { name: '성장 마인드셋', query: 'growth mindset academic achievement meta-analysis' },
]

type Suggestion = { name: string; query: string }

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())
  const [suggesting, setSuggesting] = useState(false)
  const [addingBatch, setAddingBatch] = useState(false)

  const load = () => fetch('/api/topics').then(r => r.json()).then(setTopics)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!name) return
    const autoQuery = query.trim() || `${name} meta-analysis`
    setLoading(true)
    setError('')
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, query: autoQuery, active: true })
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      setError(data.error || '추가 실패')
    } else {
      setName(''); setQuery(''); setSuggestions([])
      await load()
    }
    setLoading(false)
  }

  const remove = async (id: number) => {
    await fetch('/api/topics', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    await load()
  }

  const getSuggestions = async () => {
    if (!name.trim()) return
    setSuggesting(true)
    setSuggestions([])
    setSelectedSuggestions(new Set())
    const res = await fetch('/api/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    const data = await res.json()
    setSuggestions(Array.isArray(data) ? data : [])
    setSuggesting(false)
  }

  const toggleSuggestion = (i: number) => {
    setSelectedSuggestions(prev => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i); else n.add(i)
      return n
    })
  }

  const addSelectedSuggestions = async () => {
    if (selectedSuggestions.size === 0) return
    setAddingBatch(true)
    setError('')
    for (const i of selectedSuggestions) {
      const s = suggestions[i]
      await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.name, query: s.query, active: true })
      })
    }
    setSelectedSuggestions(new Set())
    setSuggestions([])
    await load()
    setAddingBatch(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ 주제 관리</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3">현재 주제 ({topics.length}개)</h2>
        {topics.length === 0 ? (
          <p className="text-slate-500 text-sm">주제가 없어요. 아래에서 추가해보세요.</p>
        ) : (
          <div className="space-y-2">
            {topics.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-slate-100 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.query}</p>
                </div>
                <button onClick={() => remove(t.id)}
                  className="text-xs text-red-400 hover:text-red-600 ml-4 shrink-0">삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-4">새 주제 추가</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">주제 이름 (한국어)</label>
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="예: 수면과 인지능력"
                className="flex-1 bg-slate-100 text-sm text-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500" />
              <button onClick={getSuggestions} disabled={suggesting || !name.trim()}
                className="shrink-0 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 text-xs px-3 py-2 rounded-lg transition-colors">
                {suggesting ? '추천 중...' : '🤖 추천 받기'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">검색 쿼리 (영어, 선택사항)</label>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="비워두면 자동 생성 — 예: sleep cognitive performance meta-analysis"
              className="w-full bg-slate-100 text-sm text-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          {error && <p className="text-xs text-red-500">⚠️ {error}</p>}
          <button onClick={add} disabled={loading || !name}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            {loading ? '추가 중...' : '+ 추가하기'}
          </button>
        </div>

        {/* Claude 추천 결과 — 다중 선택 */}
        {suggestions.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">🤖 AI 추천 주제 — 여러 개 선택 후 한번에 추가</p>
              {selectedSuggestions.size > 0 && (
                <button onClick={addSelectedSuggestions} disabled={addingBatch}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {addingBatch ? '추가 중...' : `✅ ${selectedSuggestions.size}개 추가하기`}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => toggleSuggestion(i)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border ${
                    selectedSuggestions.has(i)
                      ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-300'
                      : 'bg-purple-50 hover:bg-purple-100 border-purple-200'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{selectedSuggestions.has(i) ? '☑️' : '☐'}</span>
                    <div>
                      <p className="text-sm font-medium text-purple-900">{s.name}</p>
                      <p className="text-xs text-purple-600 mt-0.5 truncate">{s.query}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">주제 예시</h2>
        <div className="grid grid-cols-2 gap-2">
          {EXAMPLES.map(e => (
            <button key={e.name} onClick={() => { setName(e.name); setQuery(e.query) }}
              className="text-left bg-slate-100 hover:bg-slate-200 rounded-lg p-3 transition-colors">
              <p className="text-sm font-medium text-slate-900">{e.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{e.query}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
