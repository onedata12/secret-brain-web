'use client'
import { useEffect, useState } from 'react'

export default function CollectPage() {
  const [collecting, setCollecting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [stats, setStats] = useState({ papers: 0, cards: 0, pending: 0, approved: 0 })

  const loadStats = async () => {
    const [cards, pending, approved] = await Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/cards?status=pending').then(r => r.json()),
      fetch('/api/cards?status=approved').then(r => r.json()),
    ])
    setStats({ papers: 0, cards: cards.length, pending: pending.length, approved: approved.length })
  }

  useEffect(() => { loadStats() }, [])

  const collect = async () => {
    setCollecting(true)
    setLog(prev => [...prev, '🔍 논문 수집 시작...'])
    const res = await fetch('/api/collect', { method: 'POST' })
    const data = await res.json()
    setLog(prev => [...prev, `✅ ${data.added || 0}편 신규 논문 수집 완료`])
    setCollecting(false)
    loadStats()
  }

  const generate = async () => {
    setGenerating(true)
    setLog(prev => [...prev, '🤖 카드 생성 시작...'])
    const res = await fetch('/api/generate-cards', { method: 'POST' })
    const data = await res.json()
    setLog(prev => [...prev, `✅ ${data.generated || 0}개 카드 생성 완료`])
    setGenerating(false)
    loadStats()
  }

  const runAll = async () => {
    await collect()
    await generate()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🚀 논문 수집 & 카드 생성</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '생성된 카드', value: stats.cards },
          { label: '검토 대기', value: stats.pending },
          { label: '승인 완료', value: stats.approved },
          { label: '거절', value: stats.cards - stats.pending - stats.approved },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-400">{s.value}</p>
            <p className="text-sm text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="font-semibold mb-1">1단계: 논문 수집</h2>
          <p className="text-xs text-gray-400 mb-4">Semantic Scholar에서 메타분석 논문 수집</p>
          <button onClick={collect} disabled={collecting || generating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors">
            {collecting ? '수집 중...' : '🔍 논문 수집 시작'}
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="font-semibold mb-1">2단계: 카드 생성</h2>
          <p className="text-xs text-gray-400 mb-4">Claude AI가 논문을 인사이트 카드로 변환</p>
          <button onClick={generate} disabled={collecting || generating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors">
            {generating ? '생성 중...' : '🤖 카드 생성 시작'}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-3">⚡ 한 번에 실행</h2>
        <button onClick={runAll} disabled={collecting || generating}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors">
          {collecting || generating ? '실행 중...' : '수집 + 카드 생성 한 번에'}
        </button>
      </div>

      {log.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h2 className="font-semibold mb-3 text-sm">실행 로그</h2>
          <div className="space-y-1">
            {log.map((l, i) => (
              <p key={i} className="text-sm text-gray-300 font-mono">{l}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
