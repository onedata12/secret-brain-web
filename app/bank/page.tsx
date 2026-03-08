'use client'
import { useEffect, useState } from 'react'
import type { Card } from '@/lib/supabase'

export default function BankPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [tab, setTab] = useState<'sns' | 'landing' | 'insight'>('sns')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetch('/api/cards?status=approved').then(r => r.json()).then(setCards)
  }, [])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  if (cards.length === 0) return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📊 콘텐츠 뱅크</h1>
      <p className="text-slate-500">승인된 카드가 없어요.</p>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📊 콘텐츠 뱅크</h1>
      <p className="text-slate-500 text-sm mb-4">승인된 카드의 모든 문구를 한눈에</p>

      <div className="flex gap-2 mb-6">
        {(['sns', 'landing', 'insight'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              tab === t ? 'bg-indigo-600 text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {t === 'sns' ? '📱 SNS 문구' : t === 'landing' ? '🏠 랜딩 문구' : '💡 인사이트'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {cards.map(card => (
          <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">{card.headline}</p>
                <p className="text-xs text-slate-500 mt-0.5">{card.topic} · {card.evidence_level}</p>
              </div>
              <button onClick={() => copy(
                tab === 'sns' ? card.sns_copy : tab === 'landing' ? card.landing_copy : card.secret_brain_insight,
                card.id
              )} className="shrink-0 text-xs text-slate-500 hover:text-slate-900">
                {copied === card.id ? '✅' : '📋'}
              </button>
            </div>
            <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">
              {tab === 'sns' ? card.sns_copy : tab === 'landing' ? card.landing_copy : card.secret_brain_insight}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
