'use client'
import { useEffect, useState } from 'react'
import type { Topic } from '@/lib/supabase'

const EXAMPLES = [
  { label: '습관 형성', query: 'habit formation behavior change meta-analysis' },
  { label: '수면과 성과', query: 'sleep quality performance productivity meta-analysis' },
  { label: '운동과 뇌', query: 'exercise cognitive function brain meta-analysis' },
  { label: '마음챙김', query: 'mindfulness anxiety stress systematic review' },
  { label: '번아웃', query: 'burnout prevention workplace systematic review' },
  { label: '성장 마인드셋', query: 'growth mindset academic achievement meta-analysis' },
]

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => fetch('/api/topics').then(r => r.json()).then(setTopics)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!name || !query) return
    setLoading(true)
    await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, query, active: true })
    })
    setName(''); setQuery('')
    await load()
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ 주제 관리</h1>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3">현재 주제 ({topics.length}개)</h2>
        {topics.length === 0 ? (
          <p className="text-gray-400 text-sm">주제가 없어요. 아래에서 추가해보세요.</p>
        ) : (
          <div className="space-y-2">
            {topics.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.query}</p>
                </div>
                <button onClick={() => remove(t.id)}
                  className="text-xs text-red-400 hover:text-red-300 ml-4 shrink-0">삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-4">새 주제 추가</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">주제 이름 (한국어)</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 수면과 인지능력"
              className="w-full bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">검색 쿼리 (영어)</label>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="예: sleep cognitive performance meta-analysis"
              className="w-full bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <button onClick={add} disabled={loading || !name || !query}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
          {loading ? '추가 중...' : '추가하기'}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h2 className="font-semibold mb-3">주제 예시</h2>
        <div className="grid grid-cols-2 gap-2">
          {EXAMPLES.map(e => (
            <button key={e.label} onClick={() => { setName(e.label); setQuery(e.query) }}
              className="text-left bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-colors">
              <p className="text-sm font-medium text-white">{e.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{e.query}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
