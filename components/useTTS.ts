'use client'
import { useState, useRef, useEffect } from 'react'

// 품질 순서로 한국어 음성 선택
function getBestKoreanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const korean = voices.filter(v => v.lang.startsWith('ko'))

  // 우선순위: Microsoft Neural > Google > 기타
  const priority = [
    'Microsoft SunHi Online',
    'Microsoft Heami Online',
    'Microsoft InJoon Online',
    'Google 한국의',
    'Google Korean',
  ]

  for (const name of priority) {
    const v = korean.find(v => v.name.includes(name.split(' ')[1]) || v.name === name)
    if (v) return v
  }

  // Neural/Online 음성 우선
  const neural = korean.find(v => v.name.includes('Online') || v.name.includes('Neural'))
  if (neural) return neural

  return korean[0] || null
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [rate, setRate] = useState(1.0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [voicesReady, setVoicesReady] = useState(false)

  useEffect(() => {
    const load = () => setVoicesReady(true)
    window.speechSynthesis.addEventListener('voiceschanged', load)
    if (window.speechSynthesis.getVoices().length > 0) setVoicesReady(true)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const estimateDuration = (text: string, r = rate) =>
    Math.ceil((text.replace(/\s/g, '').length / 5) / r)

  const speak = (text: string, r = rate) => {
    window.speechSynthesis.cancel()
    if (timerRef.current) clearInterval(timerRef.current)

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.rate = r

    const voice = getBestKoreanVoice()
    if (voice) utter.voice = voice

    utter.onend = () => {
      setSpeaking(false)
      setPaused(false)
      setElapsed(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }

    window.speechSynthesis.speak(utter)
    setSpeaking(true)
    setPaused(false)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
  }

  const toggle = (text: string) => {
    if (!speaking) { speak(text); return }
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

  const changeRate = (r: number, text?: string) => {
    setRate(r)
    if (speaking && text) { stop(); setTimeout(() => speak(text, r), 100) }
  }

  return { speaking, paused, elapsed, rate, formatTime, estimateDuration, speak, toggle, stop, changeRate }
}
