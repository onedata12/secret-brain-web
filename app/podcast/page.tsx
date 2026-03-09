'use client'
import { useEffect, useState, useRef } from 'react'
import type { Card } from '@/lib/supabase'

export default function PodcastPage() {
  const [allCards, setAllCards] = useState<Card[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [script, setScript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetch('/api/cards?status=approved').then(r => r.json()).then((cards: Card[]) => {
      setAllCards(cards)
      // 기본으로 최신 5개 선택
      const ids = new Set(cards.slice(0, 5).map(c => c.id))
      setSelected(ids)
    })
  }, [])

  const toggleCard = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(allCards.map(c => c.id)))
  const selectNone = () => setSelected(new Set())

  const selectedCards = allCards.filter(c => selected.has(c.id))

  const generateScript = async () => {
    if (!selectedCards.length) return
    setGenerating(true)
    setScript('')
    setAudioUrl('')
    const res = await fetch('/api/podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: selectedCards })
    })
    const data = await res.json()
    setScript(data.script)
    setGenerating(false)
  }

  const generateAudio = async () => {
    if (!script) return
    setAudioLoading(true)
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: script })
    })
    const blob = await res.blob()
    setAudioUrl(URL.createObjectURL(blob))
    setAudioLoading(false)
  }

  const changeSpeed = (r: number) => {
    setPlaybackRate(r)
    if (audioRef.current) audioRef.current.playbackRate = r
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🎙️ 데일리 팟캐스트</h1>
      <p className="text-slate-500 text-sm mb-6">운동하면서, 출퇴근하면서 논문 공부</p>

      {allCards.length === 0 ? (
        <p className="text-slate-500">승인된 카드가 없어요. 먼저 카드를 승인해주세요.</p>
      ) : (
        <div className="space-y-4">
          {/* 카드 선택 */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">카드 선택 ({selected.size}/{allCards.length})</h2>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline">전체 선택</button>
                <button onClick={selectNone} className="text-xs text-slate-400 hover:underline">전체 해제</button>
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {allCards.map(card => (
                <label key={card.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected.has(card.id)
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                  <input type="checkbox" checked={selected.has(card.id)}
                    onChange={() => toggleCard(card.id)}
                    className="mt-0.5 accent-indigo-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{card.headline}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{card.topic} · {card.year}년 · {card.evidence_level}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-400">예상 재생시간 약 {Math.ceil(selected.size * 3)}분</p>
              <button onClick={generateScript} disabled={generating || selected.size === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {generating ? '스크립트 생성 중...' : '🎙️ 팟캐스트 스크립트 생성'}
              </button>
            </div>
          </div>

          {/* 오디오 플레이어 */}
          {script && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              {!audioUrl ? (
                <button onClick={generateAudio} disabled={audioLoading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors">
                  {audioLoading ? '⏳ 음성 변환 중... (약 20초)' : '🔊 Microsoft Neural 음성으로 변환'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">🎧 {selected.size}개 카드 브리핑</p>
                    <p className="text-xs text-slate-400">🎙️ Microsoft Neural 음성</p>
                  </div>
                  {/* 배속 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">배속:</span>
                    {[0.8, 1.0, 1.25, 1.5, 2.0].map(r => (
                      <button key={r} onClick={() => changeSpeed(r)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                          playbackRate === r
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {r}x
                      </button>
                    ))}
                  </div>
                  <audio ref={audioRef} src={audioUrl} controls
                    className="w-full h-10" style={{ colorScheme: 'light' }} />
                  <button onClick={() => { setAudioUrl(''); setAudioLoading(false) }}
                    className="text-xs text-slate-400 hover:text-slate-600">↺ 다시 변환</button>
                </div>
              )}

              {/* 스크립트 */}
              <details>
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">📝 스크립트 보기</summary>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{script}</p>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
