'use client'
import { useEffect, useState } from 'react'
import CardView from '@/components/CardView'
import type { Card } from '@/lib/supabase'

export default function ApprovedPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')

  const load = () => {
    fetch('/api/cards?status=approved')
      .then(r => r.json())
      .then(d => { setCards(d); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    await fetch('/api/cards', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setCards(prev => prev.filter(c => c.id !== id))
  }

  const topics = ['전체', ...Array.from(new Set(cards.map(c => c.topic)))]
  const filtered = filter === '전체' ? cards : cards.filter(c => c.topic === filter)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">✅ 승인된 카드</h1>
      <p className="text-slate-500 text-sm mb-6">{cards.length}개 카드</p>

      {loading ? <p className="text-slate-500">로딩 중...</p> : cards.length === 0 ? (
        <p className="text-slate-500">아직 승인된 카드가 없어요.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {topics.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{t}</button>
            ))}
          </div>
          <div className="space-y-4">
            {filtered.map(card => (
              <CardView key={card.id} card={card} showActions={false} showDelete={true} onDelete={handleDelete} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
