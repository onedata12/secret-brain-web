'use client'
import { useEffect, useState } from 'react'
import CardView from '@/components/CardView'
import type { Card } from '@/lib/supabase'

export default function ReviewPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/cards?status=pending')
    const data = await res.json()
    setCards(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    await fetch('/api/cards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    setCards(prev => prev.filter(c => c.id !== id))
  }

  const topics = ['전체', ...Array.from(new Set(cards.map(c => c.topic)))]
  const filtered = filter === '전체' ? cards : cards.filter(c => c.topic === filter)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">📥 검토 대기</h1>
      <p className="text-gray-400 text-sm mb-6">총 {cards.length}개 카드</p>

      {loading ? (
        <p className="text-gray-400">로딩 중...</p>
      ) : cards.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400">검토할 카드가 없어요.</p>
          <a href="/collect" className="text-indigo-400 text-sm hover:underline mt-2 block">수집 실행 →</a>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {topics.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}>{t}</button>
            ))}
          </div>
          <div className="space-y-4">
            {filtered.map(card => (
              <CardView key={card.id} card={card} showActions onStatusChange={handleStatusChange} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
