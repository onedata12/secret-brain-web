'use client'
import { useEffect, useState, useRef } from 'react'
import type { Card } from '@/lib/supabase'

export default function PodcastPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [script, setScript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [rate, setRate] = useState(1.0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    fetch('/api/cards?status=approved').then(r => r.json()).then(setCards)
  }, [])

  const generateScript = async () => {
    if (!cards.length) return
    setGenerating(true)
    setScript('')
    const res = await fetch('/api/podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards })
    })
    const data = await res.json()
    setScript(data.script)
    setGenerating(false)
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const estimatedDuration = script ? Math.ceil((script.length / 300) * 60 / rate) : 0

  const startSpeech = (r = rate) => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(script)
    utter.lang = 'ko-KR'
    utter.rate = r
    utter.onend = () => {
      setSpeaking(false)
      setPaused(false)
      setElapsed(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    utterRef.current = utter
    window.speechSynthesis.speak(utter)
    setSpeaking(true)
    setPaused(false)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
  }

  const togglePlay = () => {
    if (!speaking) { startSpeech(); return }
    if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
    } else {
      window.speechSynthesis.pause()
      setPaused(true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const stop = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setPaused(false)
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const changeRate = (r: number) => {
    setRate(r)
    if (speaking) { stop(); setTimeout(() => startSpeech(r), 100) }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🎙️ 데일리 팟캐스트</h1>
      <p className="text-gray-400 text-sm mb-6">운동하면서, 출퇴근하면서 논문 공부</p>

      {cards.length === 0 ? (
        <p className="text-gray-400">승인된 카드가 없어요. 먼저 카드를 승인해주세요.</p>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-4">
              승인된 카드 {cards.length}개 기반 · 예상 재생시간 약 {Math.ceil(cards.slice(0,5).length * 4)}분
            </p>
            <button onClick={generateScript} disabled={generating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors">
              {generating ? '스크립트 생성 중... (약 20초)' : '🎙️ 오늘의 팟캐스트 생성'}
            </button>
          </div>

          {script && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
              {/* 플레이어 */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">🎧 오늘의 논문 브리핑</p>
                  <span className="text-xs text-gray-400">
                    {speaking ? formatTime(elapsed) : '0:00'} / ~{formatTime(estimatedDuration)}
                  </span>
                </div>

                {/* 진행바 */}
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: estimatedDuration > 0 ? `${Math.min((elapsed / estimatedDuration) * 100, 100)}%` : '0%' }} />
                </div>

                {/* 컨트롤 */}
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    {speaking && !paused ? '⏸ 일시정지' : speaking && paused ? '▶ 계속' : '▶ 재생'}
                  </button>
                  {speaking && (
                    <button onClick={stop} className="bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-600">
                      ⏹
                    </button>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-xs text-gray-500 mr-1">배속:</span>
                    {[0.8, 1.0, 1.25, 1.5, 2.0].map(r => (
                      <button key={r} onClick={() => changeRate(r)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          rate === r ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}>
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 스크립트 */}
              <details>
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200">📝 스크립트 보기</summary>
                <p className="mt-2 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{script}</p>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
