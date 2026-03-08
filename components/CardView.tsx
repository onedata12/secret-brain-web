'use client'
import { useState } from 'react'
import type { Card } from '@/lib/supabase'

function getTrustInfo(card: Card) {
  const evidence = card.evidence_level || ''
  const citations = card.citations || 0
  let base = evidence.includes('메타분석') ? 5
    : evidence.includes('체계적 문헌고찰') ? 4
    : evidence.includes('무작위') ? 3
    : evidence.includes('리뷰') ? 3 : 2

  if (citations >= 500) base = Math.min(base + 1, 5)
  else if (citations < 20 && base > 2) base -= 1

  const stars = '⭐'.repeat(base) + '☆'.repeat(5 - base)
  const labels: Record<number, [string, string]> = {
    5: ['🟢 매우 신뢰할 수 있음', '수백~수천 명 이상을 대상으로 여러 연구를 종합한 결과예요.'],
    4: ['🟢 신뢰할 수 있음', '다수의 연구를 체계적으로 검토한 결과예요.'],
    3: ['🟡 참고할 만함', '실험으로 검증된 연구지만 단일 연구예요.'],
    2: ['🟠 참고용', '관찰 연구나 소규모 연구예요.'],
    1: ['🔴 주의 필요', '근거가 제한적이에요.'],
  }
  const [label, desc] = labels[base] || labels[2]
  return { stars, label, desc }
}

type Props = {
  card: Card
  showActions?: boolean
  onStatusChange?: (id: string, status: 'approved' | 'rejected') => void
}

export default function CardView({ card, showActions = true, onStatusChange }: Props) {
  const [tab, setTab] = useState<'explain' | 'sns' | 'landing'>('explain')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [deepAnalysis, setDeepAnalysis] = useState('')
  const [deepLoading, setDeepLoading] = useState(false)
  const [showDeep, setShowDeep] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showReader, setShowReader] = useState(false)
  const [sentences, setSentences] = useState<{ id: number; en: string; ko: string }[]>([])
  const [translateLoading, setTranslateLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [speaking, setSpeaking] = useState(false)

  const trust = getTrustInfo(card)

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const speak = (text: string) => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.rate = 1.0
    utter.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
    setSpeaking(true)
  }

  const sendChat = async (msg?: string) => {
    const message = msg || chatInput
    if (!message.trim()) return
    const newMessages = [...chatMessages, { role: 'user', content: message }]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'qa', card, messages: chatMessages, userMessage: message })
    })
    const data = await res.json()
    setChatMessages([...newMessages, { role: 'assistant', content: data.answer }])
    setChatLoading(false)
  }

  const loadDeepAnalysis = async () => {
    setDeepLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'deep', card, messages: [], userMessage: '심층 분석 시작' })
    })
    const data = await res.json()
    setDeepAnalysis(data.answer)
    setDeepLoading(false)
  }

  const loadTranslation = async () => {
    if (sentences.length > 0) { setShowReader(true); return }
    setTranslateLoading(true)
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: card.abstract_text })
    })
    const data = await res.json()
    setSentences(data)
    setShowReader(true)
    setTranslateLoading(false)
  }

  const audioText = `${card.headline}. ${card.easy_explanation} ${card.why_important} 시크릿 브레인 인사이트입니다. ${card.secret_brain_insight}`

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">{card.headline}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {card.evidence_level} · 📌 {card.topic} · {card.year}년 · 인용 {card.citations}회
          </p>
        </div>
        {card.doi_url && (
          <a href={card.doi_url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs text-indigo-400 hover:underline">원문 →</a>
        )}
      </div>

      {/* 신뢰도 */}
      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-sm font-medium">{trust.stars} {trust.label}</p>
        <p className="text-xs text-gray-400 mt-1">{trust.desc}</p>
      </div>

      {/* 핵심 */}
      <div className="bg-indigo-900/30 border border-indigo-800 rounded-lg p-3">
        <p className="text-sm"><span className="font-bold">💡 핵심:</span> {card.one_line}</p>
      </div>

      {/* 탭 */}
      <div>
        <div className="flex gap-1 mb-3">
          {(['explain', 'sns', 'landing'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {t === 'explain' ? '🗣️ 쉬운 설명' : t === 'sns' ? '📱 SNS 문구' : '🏠 랜딩 문구'}
            </button>
          ))}
        </div>

        {tab === 'explain' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-200 leading-relaxed">{card.easy_explanation}</p>
            <p className="text-sm text-gray-400 italic">{card.why_important}</p>
            <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-3 mt-2">
              <p className="text-sm text-purple-200">{card.secret_brain_insight}</p>
            </div>
          </div>
        )}

        {tab === 'sns' && (
          <div className="space-y-2">
            <div className="bg-gray-800 rounded-lg p-3 relative">
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{card.sns_copy}</p>
              <button onClick={() => copy(card.sns_copy, 'sns')}
                className="absolute top-2 right-2 text-xs text-gray-400 hover:text-white">
                {copied === 'sns' ? '✅ 복사됨' : '📋 복사'}
              </button>
            </div>
          </div>
        )}

        {tab === 'landing' && (
          <div className="bg-gray-800 rounded-lg p-3 relative">
            <p className="text-sm text-gray-200 whitespace-pre-wrap">{card.landing_copy}</p>
            <button onClick={() => copy(card.landing_copy, 'landing')}
              className="absolute top-2 right-2 text-xs text-gray-400 hover:text-white">
              {copied === 'landing' ? '✅ 복사됨' : '📋 복사'}
            </button>
          </div>
        )}
      </div>

      {/* 키워드 */}
      {card.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.keywords.map(k => (
            <span key={k} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">{k}</span>
          ))}
        </div>
      )}

      {/* 오디오 */}
      <div className="border-t border-gray-800 pt-3">
        <button onClick={() => speak(audioText)}
          className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
            speaking ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}>
          {speaking ? '⏹ 정지' : '🔊 오디오로 듣기'}
        </button>
      </div>

      {/* 논문 정보 */}
      <details className="border-t border-gray-800 pt-3">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200">📄 논문 정보</summary>
        <div className="mt-2 space-y-1 text-sm text-gray-300">
          <p><span className="text-gray-500">제목:</span> {card.paper_title}</p>
          <p><span className="text-gray-500">저자:</span> {card.authors?.join(', ')}</p>
          <div className="flex gap-2 mt-2">
            {card.pdf_url && (
              <a href={card.pdf_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline">📥 PDF 무료 다운로드</a>
            )}
            {card.doi_url && (
              <a href={card.doi_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline">🔗 저널 페이지</a>
            )}
          </div>
        </div>
      </details>

      {/* 심층 분석 */}
      <details className="border-t border-gray-800 pt-3" onToggle={e => {
        if ((e.target as HTMLDetailsElement).open && !deepAnalysis && !deepLoading) loadDeepAnalysis()
      }}>
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200">🎓 깊이 공부하기</summary>
        <div className="mt-2">
          {deepLoading ? <p className="text-sm text-gray-400">분석 중...</p>
            : deepAnalysis ? <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{deepAnalysis}</div>
            : null}
        </div>
      </details>

      {/* 원문 읽기 */}
      {card.abstract_text && (
        <details className="border-t border-gray-800 pt-3">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200"
            onClick={() => !showReader && loadTranslation()}>
            📖 초록 원문 읽기 (영/한)
          </summary>
          {translateLoading && <p className="text-sm text-gray-400 mt-2">번역 중...</p>}
          {showReader && sentences.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-4 max-h-80 overflow-y-auto">
              <div>
                <p className="text-xs text-gray-500 font-bold mb-2">🇺🇸 영문</p>
                {sentences.map(s => (
                  <p key={s.id} className="text-xs text-gray-300 mb-2 leading-relaxed">
                    <span className="text-gray-600 mr-1">{s.id}.</span>{s.en}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold mb-2">🇰🇷 한국어</p>
                {sentences.map(s => (
                  <p key={s.id} className="text-xs text-gray-300 mb-2 leading-relaxed">
                    <span className="text-gray-600 mr-1">{s.id}.</span>{s.ko}
                  </p>
                ))}
              </div>
            </div>
          )}
        </details>
      )}

      {/* Q&A 채팅 */}
      <details className="border-t border-gray-800 pt-3">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200">💬 논문에 대해 질문하기</summary>
        <div className="mt-2 space-y-2">
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-1">
              {['이 결과가 한국인에게도 적용돼?', '샘플 수가 충분한 거야?', '반대되는 연구도 있어?', '실생활에 어떻게 적용할 수 있어?'].map(q => (
                <button key={q} onClick={() => sendChat(q)}
                  className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700">{q}</button>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div key={i} className={`text-sm p-2 rounded-lg ${m.role === 'user' ? 'bg-indigo-900/40 text-right' : 'bg-gray-800'}`}>
                <p className="text-gray-200 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {chatLoading && <p className="text-sm text-gray-400">생각 중...</p>}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="궁금한 거 물어봐"
              className="flex-1 bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500" />
            <button onClick={() => sendChat()}
              className="bg-indigo-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-indigo-700">전송</button>
          </div>
        </div>
      </details>

      {/* 승인/거절 */}
      {showActions && card.status === 'pending' && (
        <div className="flex gap-2 border-t border-gray-800 pt-3">
          <button onClick={() => onStatusChange?.(card.id, 'approved')}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 rounded-lg font-medium transition-colors">
            ✅ 승인
          </button>
          <button onClick={() => onStatusChange?.(card.id, 'rejected')}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
            ❌ 거절
          </button>
        </div>
      )}
    </div>
  )
}
