'use client'
import { useEffect, useState } from 'react'
import CardView from '@/components/CardView'
import type { Card } from '@/lib/supabase'

export default function ReviewPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectMode, setSelectMode] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/cards?status=pending')
    const data = await res.json()
    setCards(data)
    setLoading(false)
    setSelected(new Set())
  }

  useEffect(() => { load() }, [])

  const topics = ['전체', ...Array.from(new Set(cards.map(c => c.topic)))]
  const filtered = filter === '전체' ? cards : cards.filter(c => c.topic === filter)
  const filteredIds = filtered.map(c => c.id)

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    await fetch('/api/cards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    setCards(prev => prev.filter(c => c.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    const allSelected = filteredIds.every(id => selected.has(id))
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelected(prev => new Set([...prev, ...filteredIds]))
    }
  }

  const bulkAction = async (action: 'approved' | 'rejected' | 'delete') => {
    if (!selected.size) return
    const ids = Array.from(selected)
    setBulkLoading(true)

    if (action === 'delete') {
      await fetch('/api/cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
    } else {
      await fetch('/api/cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: action })
      })
    }

    setCards(prev => prev.filter(c => !ids.includes(c.id)))
    setSelected(new Set())
    setBulkLoading(false)
  }

  const deleteAll = async () => {
    if (!confirm(`현재 필터(${filter})의 카드 ${filtered.length}개를 모두 삭제할까요?`)) return
    setBulkLoading(true)
    await fetch('/api/cards', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: filteredIds })
    })
    setCards(prev => prev.filter(c => !filteredIds.includes(c.id)))
    setSelected(new Set())
    setBulkLoading(false)
  }

  const approveAll = async () => {
    if (!confirm(`현재 필터(${filter})의 카드 ${filtered.length}개를 모두 승인할까요?`)) return
    setBulkLoading(true)
    await fetch('/api/cards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: filteredIds, status: 'approved' })
    })
    setCards(prev => prev.filter(c => !filteredIds.includes(c.id)))
    setSelected(new Set())
    setBulkLoading(false)
  }

  const selectedInFilter = filteredIds.filter(id => selected.has(id))
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">📥 검토 대기</h1>
        <span className="text-sm text-slate-400">총 {cards.length}개</span>
      </div>

      {loading ? (
        <p className="text-slate-500 mt-6">로딩 중...</p>
      ) : cards.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center mt-6">
          <p className="text-slate-500">검토할 카드가 없어요.</p>
          <a href="/collect" className="text-indigo-400 text-sm hover:underline mt-2 block">논문 검색하러 가기 →</a>
        </div>
      ) : (
        <>
          {/* 필터 + 액션 툴바 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 space-y-3">
            {/* 주제 필터 */}
            <div className="flex gap-1.5 flex-wrap">
              {topics.map(t => (
                <button key={t} onClick={() => setFilter(t)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors font-medium ${
                    filter === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{t} {t === '전체' ? `(${cards.length})` : `(${cards.filter(c => c.topic === t).length})`}
                </button>
              ))}
            </div>

            {/* 일괄 액션 버튼 */}
            <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
              <button onClick={() => setSelectMode(!selectMode)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectMode ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {selectMode ? '✓ 선택 모드' : '☐ 선택 모드'}
              </button>

              {selectMode && (
                <>
                  <button onClick={toggleSelectAll}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                    {allFilteredSelected ? '전체 해제' : `전체 선택 (${filtered.length})`}
                  </button>
                  {selectedInFilter.length > 0 && (
                    <span className="text-xs text-indigo-600 font-medium">{selectedInFilter.length}개 선택됨</span>
                  )}
                </>
              )}

              <div className="ml-auto flex gap-2 flex-wrap">
                {selectMode && selected.size > 0 ? (
                  <>
                    <button onClick={() => bulkAction('approved')} disabled={bulkLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                      ✅ 선택 승인 ({selected.size})
                    </button>
                    <button onClick={() => bulkAction('rejected')} disabled={bulkLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                      ❌ 선택 거절 ({selected.size})
                    </button>
                    <button onClick={() => bulkAction('delete')} disabled={bulkLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 disabled:opacity-50">
                      🗑 선택 삭제 ({selected.size})
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={approveAll} disabled={bulkLoading || filtered.length === 0}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50">
                      ✅ 전체 승인
                    </button>
                    <button onClick={deleteAll} disabled={bulkLoading || filtered.length === 0}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 disabled:opacity-50">
                      🗑 전체 삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 카드 목록 */}
          <div className="space-y-4">
            {filtered.map(card => (
              <div key={card.id} className="relative">
                {/* 체크박스 */}
                {selectMode && (
                  <label className="absolute top-4 left-4 z-10 cursor-pointer">
                    <input type="checkbox" checked={selected.has(card.id)}
                      onChange={() => toggleSelect(card.id)}
                      className="w-4 h-4 accent-indigo-600" />
                  </label>
                )}
                <div className={selectMode ? 'pl-8' : ''}>
                  <div onClick={selectMode ? () => toggleSelect(card.id) : undefined}
                    className={selectMode ? `cursor-pointer ${selected.has(card.id) ? 'ring-2 ring-indigo-400 rounded-xl' : ''}` : ''}>
                    <CardView
                      card={card}
                      showActions={!selectMode}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
