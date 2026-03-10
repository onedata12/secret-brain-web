'use client'
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
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

// 마크다운 컴포넌트 (모바일 최적화 + 테이블 스크롤)
const mdComponents = {
  h1: ({ children }: any) => <p className="font-bold text-slate-800 mt-3 mb-1">{children}</p>,
  h2: ({ children }: any) => <p className="font-bold text-slate-800 mt-3 mb-1">{children}</p>,
  h3: ({ children }: any) => <p className="font-semibold text-slate-700 mt-2 mb-1">{children}</p>,
  hr: () => <hr className="border-t border-slate-200 my-3" />,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2 rounded border border-slate-200">
      <table className="text-xs border-collapse w-full min-w-[300px]">{children}</table>
    </div>
  ),
  th: ({ children }: any) => <th className="border border-slate-200 px-2 py-1.5 bg-slate-100 font-semibold text-left whitespace-nowrap">{children}</th>,
  td: ({ children }: any) => <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{children}</td>,
  p: ({ children }: any) => <p className="mb-2 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-slate-900">{children}</strong>,
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
}

// 채팅 메시지 마크다운 (헤더 없이)
const chatMdComponents = {
  p: ({ children }: any) => <p className="mb-1 leading-relaxed last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  li: ({ children }: any) => <li className="mb-0.5">{children}</li>,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-1">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => <th className="border border-current px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }: any) => <td className="border border-current px-2 py-1">{children}</td>,
}

type Props = {
  card: Card
  showActions?: boolean
  showDelete?: boolean
  onApprove?: (id: string) => void
  onDelete?: (id: string) => void
}

export default function CardView({ card, showActions = true, showDelete = false, onApprove, onDelete }: Props) {
  const [tab, setTab] = useState<'explain' | 'sns' | 'landing'>('explain')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [deepAnalysis, setDeepAnalysis] = useState('')
  const [deepLoading, setDeepLoading] = useState(false)
  const [showReader, setShowReader] = useState(false)
  const [sentences, setSentences] = useState<{ id: number; en: string; ko: string }[]>([])
  const [translateLoading, setTranslateLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const trust = getTrustInfo(card)

  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // 스크롤 위치 감지 — 맨 아래가 아니면 ↓ 버튼 표시
  const handleChatScroll = () => {
    const el = chatContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setShowScrollBtn(!atBottom)
  }

  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  // 스트리밍 채팅
  const sendChat = async (msg?: string) => {
    const message = msg || chatInput
    if (!message.trim() || chatLoading) return
    const newMessages = [...chatMessages, { role: 'user', content: message }]
    setChatMessages([...newMessages, { role: 'assistant', content: '' }])
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'qa', card, messages: chatMessages, userMessage: message })
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let answer = ''
      let rafId = 0
      let pending = false
      const flush = () => { setChatMessages([...newMessages, { role: 'assistant', content: answer }]); pending = false }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        if (!pending) { pending = true; rafId = requestAnimationFrame(flush) }
      }
      cancelAnimationFrame(rafId)
      setChatMessages([...newMessages, { role: 'assistant', content: answer }])
    } finally {
      setChatLoading(false)
    }
  }

  // 스트리밍 깊이 공부하기 (부드러운 렌더링)
  const loadDeepAnalysis = async () => {
    if (deepAnalysis || deepLoading) return
    setDeepLoading(true)
    setDeepAnalysis('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'deep', card, messages: [], userMessage: '심층 분석 시작' })
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let analysis = ''
      let rafId = 0
      let pending = false
      const flush = () => { setDeepAnalysis(analysis); pending = false }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        analysis += decoder.decode(value, { stream: true })
        if (!pending) { pending = true; rafId = requestAnimationFrame(flush) }
      }
      cancelAnimationFrame(rafId)
      setDeepAnalysis(analysis)
    } finally {
      setDeepLoading(false)
    }
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

  const audioText = [
    `오늘의 논문 인사이트입니다.`,
    `${card.headline}.`,
    `핵심 한 줄 요약. ${card.one_line}.`,
    `쉬운 설명. ${card.easy_explanation}`,
    `왜 중요한가. ${card.why_important}`,
    `시크릿 브레인 인사이트. ${card.secret_brain_insight}`,
    card.landing_copy ? `마케팅 관점에서 보면. ${card.landing_copy}` : '',
    `이 연구는 ${card.year}년에 발표된 ${card.evidence_level}으로, 지금까지 ${card.citations}회 인용되었습니다.`,
    `논문 제목은 ${card.paper_title}입니다.`,
    `이상으로 시크릿 브레인 논문 브리핑을 마칩니다.`,
  ].filter(Boolean).join(' ')

  const loadAudio = async () => {
    if (audioUrl) return
    setAudioLoading(true)
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: audioText })
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 space-y-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base md:text-lg font-bold text-slate-900">{card.headline}</h3>
          {card.paper_title && (
            <p className="text-xs text-slate-600 mt-0.5 leading-snug font-medium">{card.paper_title}</p>
          )}
          {card.paper_title_ko && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{card.paper_title_ko}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {card.evidence_level} · 📌 {card.topic} · {card.year}년 · 인용 {card.citations}회
          </p>
        </div>
        {card.doi_url && (
          <a href={card.doi_url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs text-indigo-600 hover:underline font-medium">원문 →</a>
        )}
      </div>

      {/* 신뢰도 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-sm font-medium text-slate-800">{trust.stars} {trust.label}</p>
        <p className="text-xs text-slate-500 mt-1">{trust.desc}</p>
      </div>

      {/* 핵심 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <p className="text-sm text-indigo-900"><span className="font-bold">💡 핵심:</span> {card.one_line}</p>
      </div>

      {/* 탭 */}
      <div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {(['explain', 'sns', 'landing'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {t === 'explain' ? '🗣️ 쉬운 설명' : t === 'sns' ? '📱 SNS 문구' : '🏠 랜딩 문구'}
            </button>
          ))}
        </div>

        {tab === 'explain' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{card.easy_explanation}</p>
            <p className="text-sm text-slate-500 italic">{card.why_important}</p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
              <p className="text-sm text-purple-800">{card.secret_brain_insight}</p>
            </div>
          </div>
        )}

        {tab === 'sns' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
            <p className="text-sm text-slate-700 whitespace-pre-wrap pr-16">{card.sns_copy}</p>
            <button onClick={() => copy(card.sns_copy, 'sns')}
              className="absolute top-2 right-2 text-xs text-slate-400 hover:text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded">
              {copied === 'sns' ? '✅' : '📋 복사'}
            </button>
          </div>
        )}

        {tab === 'landing' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
            <p className="text-sm text-slate-700 whitespace-pre-wrap pr-16">{card.landing_copy}</p>
            <button onClick={() => copy(card.landing_copy, 'landing')}
              className="absolute top-2 right-2 text-xs text-slate-400 hover:text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded">
              {copied === 'landing' ? '✅' : '📋 복사'}
            </button>
          </div>
        )}
      </div>

      {/* 키워드 */}
      {card.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.keywords.map(k => (
            <span key={k} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{k}</span>
          ))}
        </div>
      )}

      {/* 오디오 */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        {!audioUrl ? (
          <button onClick={loadAudio} disabled={audioLoading}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 font-medium transition-colors">
            {audioLoading ? '⏳ 음성 생성 중...' : '🔊 오디오로 듣기'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-400">🎙️ Microsoft Neural 음성</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mr-1">배속:</span>
                {[0.8, 1.0, 1.25, 1.5, 2.0].map(r => (
                  <button key={r} onClick={() => changeSpeed(r)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      playbackRate === r ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>{r}x</button>
                ))}
              </div>
            </div>
            <audio ref={audioRef} src={audioUrl} controls className="w-full h-10" style={{ colorScheme: 'light' }} />
          </div>
        )}
      </div>

      {/* 논문 정보 */}
      <details className="border-t border-slate-100 pt-3">
        <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-800 font-medium">📄 논문 정보</summary>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p><span className="text-slate-400">제목:</span> {card.paper_title}</p>
          <p><span className="text-slate-400">저자:</span> {card.authors?.join(', ')}</p>
          <div className="flex gap-3 mt-2">
            {card.pdf_url && (
              <a href={card.pdf_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline">📥 PDF 무료 다운로드</a>
            )}
            {card.doi_url && (
              <a href={card.doi_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline">🔗 저널 페이지</a>
            )}
          </div>
        </div>
      </details>

      {/* 깊이 공부하기 — 스트리밍 */}
      <details className="border-t border-slate-100 pt-3" onToggle={e => {
        if ((e.target as HTMLDetailsElement).open) loadDeepAnalysis()
      }}>
        <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-800 font-medium">🎓 깊이 공부하기</summary>
        <div className="mt-3">
          {deepLoading && !deepAnalysis && (
            <p className="text-sm text-slate-400">분석 중...</p>
          )}
          {deepAnalysis && (
            <div className="prose prose-sm max-w-none text-slate-700 text-sm leading-relaxed">
              <ReactMarkdown components={mdComponents}>{deepAnalysis}</ReactMarkdown>
              {deepLoading && (
                <span className="inline-block w-1.5 h-4 bg-slate-400 animate-pulse ml-0.5 align-middle rounded" />
              )}
            </div>
          )}
        </div>
      </details>

      {/* 원문 읽기 */}
      {card.abstract_text && (
        <details className="border-t border-slate-100 pt-3">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-800 font-medium"
            onClick={() => !showReader && loadTranslation()}>
            📖 초록 원문 읽기 (영/한)
          </summary>
          {translateLoading && <p className="text-sm text-slate-400 mt-2">번역 중...</p>}
          {showReader && sentences.length > 0 && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-80 overflow-y-auto">
              <div>
                <p className="text-xs text-slate-400 font-bold mb-2">🇺🇸 영문</p>
                {sentences.map(s => (
                  <p key={s.id} className="text-xs text-slate-600 mb-2 leading-relaxed">
                    <span className="text-slate-300 mr-1">{s.id}.</span>{s.en}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold mb-2">🇰🇷 한국어</p>
                {sentences.map(s => (
                  <p key={s.id} className="text-xs text-slate-600 mb-2 leading-relaxed">
                    <span className="text-slate-300 mr-1">{s.id}.</span>{s.ko}
                  </p>
                ))}
              </div>
            </div>
          )}
        </details>
      )}

      {/* Q&A 채팅 — 스트리밍 + ChatGPT 스타일 */}
      <details className="border-t border-slate-100 pt-3">
        <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-800 font-medium">💬 논문에 대해 질문하기</summary>
        <div className="mt-3 space-y-3">
          {/* 예시 질문 */}
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {['이 결과가 한국인에게도 적용돼?', '샘플 수가 충분한 거야?', '반대되는 연구도 있어?', '실생활에 어떻게 적용할 수 있어?'].map(q => (
                <button key={q} onClick={() => sendChat(q)}
                  className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-full hover:bg-indigo-50 hover:text-indigo-700 transition-colors">{q}</button>
              ))}
            </div>
          )}

          {/* 메시지 목록 */}
          {chatMessages.length > 0 && (
            <div className="relative">
              <div ref={chatContainerRef} onScroll={handleChatScroll}
                className="space-y-2 max-h-[360px] overflow-y-auto px-1">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                    }`}>
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown components={chatMdComponents}>{m.content}</ReactMarkdown>
                          {chatLoading && i === chatMessages.length - 1 && m.content === '' && (
                            <span className="inline-flex gap-1">
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          )}
                          {chatLoading && i === chatMessages.length - 1 && m.content !== '' && (
                            <span className="inline-block w-1.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-middle rounded" />
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              {/* ↓ 스크롤 버튼 (Gemini 스타일) */}
              {showScrollBtn && (
                <button onClick={scrollToBottom}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-md rounded-full w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all z-10">
                  ↓
                </button>
              )}
            </div>
          )}

          {/* 입력창 */}
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="궁금한 거 물어봐"
              disabled={chatLoading}
              className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
            />
            <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
              className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0">
              전송
            </button>
          </div>
        </div>
      </details>

      {/* 승인/삭제 (검토 대기) */}
      {showActions && card.status === 'pending' && (
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <button onClick={() => onApprove?.(card.id)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2.5 rounded-lg font-medium transition-colors">
            ✅ 승인
          </button>
          <button onClick={() => onDelete?.(card.id)}
            className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 text-sm py-2.5 rounded-lg transition-colors">
            🗑 삭제
          </button>
        </div>
      )}

      {/* 삭제 (승인된 카드) */}
      {showDelete && (
        <div className="border-t border-slate-100 pt-3">
          <button onClick={() => onDelete?.(card.id)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors">
            🗑 카드 삭제
          </button>
        </div>
      )}
    </div>
  )
}
