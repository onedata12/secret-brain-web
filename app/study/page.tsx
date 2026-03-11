'use client'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Card } from '@/lib/supabase'

function getDueCards(cards: Card[]) {
  const intervals = [1, 3, 7, 14, 30]
  const now = new Date()
  return cards.filter(card => {
    const log = card.review_log || []
    const count = log.length
    if (count === 0) {
      const base = new Date(card.reviewed_at || card.generated_at)
      return (now.getTime() - base.getTime()) / 86400000 >= 1
    }
    if (count >= intervals.length) return false
    const last = new Date(log[log.length - 1])
    return (now.getTime() - last.getTime()) / 86400000 >= intervals[count]
  })
}

export default function StudyPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [tab, setTab] = useState<'review' | 'feynman'>('review')
  const [recallState, setRecallState] = useState<Record<string, string>>({})
  const [feynmanCard, setFeynmanCard] = useState<Card | null>(null)
  const [feynmanMessages, setFeynmanMessages] = useState<{ role: string; content: string }[]>([])
  const [feynmanInput, setFeynmanInput] = useState('')
  const [feynmanLoading, setFeynmanLoading] = useState(false)

  useEffect(() => {
    fetch('/api/cards?status=approved').then(r => r.json()).then(data => {
      setCards(data)
      if (data.length > 0) setFeynmanCard(data[0])
    })
  }, [])

  const dueCards = getDueCards(cards)

  const markReviewed = async (card: Card) => {
    const newLog = [...(card.review_log || []), new Date().toISOString()]
    await fetch('/api/cards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, status: 'approved', review_log: newLog })
    })
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, review_log: newLog } : c))
    setRecallState(prev => { const n = { ...prev }; delete n[card.id]; return n })
  }

  const sendFeynman = async () => {
    if (!feynmanInput.trim() || !feynmanCard || feynmanLoading) return
    const message = feynmanInput
    const newMessages = [...feynmanMessages, { role: 'user', content: message }]
    setFeynmanMessages([...newMessages, { role: 'assistant', content: '' }])
    setFeynmanInput('')
    setFeynmanLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'feynman', card: feynmanCard, messages: feynmanMessages, userMessage: message })
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let answer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
      }
      setFeynmanMessages([...newMessages, { role: 'assistant', content: answer }])
    } finally {
      setFeynmanLoading(false)
    }
  }

  const startFeynman = () => {
    setFeynmanMessages([{
      role: 'assistant',
      content: `야, ${feynmanCard?.topic} 공부했다고? 나 그거 진짜 하나도 몰라. 쉽게 설명해줄 수 있어?`
    }])
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">🧠 복습 & 파인만 모드</h1>

      <div className="flex gap-2 mb-5">
        {(['review', 'feynman'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm rounded-xl transition-colors font-medium touch-manipulation ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
            }`}>
            {t === 'review' ? '🔔 복습 알림' : '🎓 파인만 모드'}
          </button>
        ))}
      </div>

      {tab === 'review' && (
        <div>
          {dueCards.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-green-600 font-medium">✅ 오늘 복습할 카드가 없어!</p>
              <p className="text-slate-400 text-sm mt-1">총 {cards.length}개 카드 관리 중</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-indigo-600 text-sm font-medium">🔔 {dueCards.length}개 복습할 카드가 있어!</p>
              {dueCards.map(card => (
                <div key={card.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <p className="font-bold text-slate-900">{card.headline}</p>
                  <p className="text-xs text-slate-400 mt-1">{card.evidence_level} · {card.topic} · 복습 {(card.review_log || []).length}회차</p>

                  {!recallState[card.id] ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-slate-500">이 논문에서 배운 거 뭐였지? 먼저 떠올려봐 👇</p>
                      <textarea
                        placeholder="기억나는 대로 써봐 (틀려도 괜찮아)"
                        className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                        rows={3}
                        onChange={e => setRecallState(prev => ({ ...prev, [`draft_${card.id}`]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setRecallState(prev => ({ ...prev, [card.id]: prev[`draft_${card.id}`] || '(비워둠)' }))}
                          className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-xl active:bg-indigo-700 font-medium touch-manipulation">확인하기</button>
                        <button onClick={() => setRecallState(prev => ({ ...prev, [card.id]: '(스킵)' }))}
                          className="bg-slate-100 text-slate-600 text-sm px-4 py-2.5 rounded-xl active:bg-slate-200 touch-manipulation">바로 정답 보기</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                        <p className="text-sm font-medium text-indigo-900">💡 {card.one_line}</p>
                      </div>
                      <p className="text-sm text-slate-600">{card.easy_explanation}</p>
                      <button onClick={() => markReviewed(card)}
                        className="bg-green-600 active:bg-green-700 text-white text-sm px-4 py-2.5 rounded-xl font-medium touch-manipulation">
                        ✅ 복습 완료
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'feynman' && (
        <div>
          <p className="text-slate-400 text-sm mb-4">Claude가 완전히 모르는 척하고 질문을 던져. 설명하다 막히는 부분 = 아직 모르는 부분이야.</p>

          {cards.length === 0 ? <p className="text-slate-400">승인된 카드가 없어요.</p> : (
            <div className="space-y-4">
              <select value={feynmanCard?.id || ''} onChange={e => {
                const card = cards.find(c => c.id === e.target.value)
                setFeynmanCard(card || null)
                setFeynmanMessages([])
              }} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300">
                {cards.map(c => (
                  <option key={c.id} value={c.id}>{c.headline} ({c.topic})</option>
                ))}
              </select>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="space-y-2 px-1">
                  {feynmanMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                      }`}>
                        {m.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none">
                            {m.content ? (
                              <ReactMarkdown>{m.content}</ReactMarkdown>
                            ) : feynmanLoading && i === feynmanMessages.length - 1 ? (
                              <span className="inline-flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {feynmanMessages.length === 0 ? (
                  <button onClick={startFeynman}
                    className="w-full bg-indigo-600 active:bg-indigo-700 text-white text-sm py-3 rounded-xl font-medium touch-manipulation">
                    🎓 파인만 모드 시작
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input value={feynmanInput} onChange={e => setFeynmanInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendFeynman()}
                      placeholder="설명해봐!"
                      disabled={feynmanLoading}
                      className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60" />
                    <button onClick={sendFeynman} disabled={feynmanLoading || !feynmanInput.trim()}
                      className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-xl active:bg-indigo-700 disabled:opacity-50 transition-colors touch-manipulation">전송</button>
                    <button onClick={() => setFeynmanMessages([])}
                      className="bg-slate-100 text-slate-500 text-sm px-3 py-2.5 rounded-xl active:bg-slate-200 transition-colors touch-manipulation">🔄</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
