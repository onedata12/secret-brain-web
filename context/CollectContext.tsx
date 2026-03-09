'use client'
import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react'

export type PaperItem = {
  paperId: string
  titleEn: string
  titleKo: string
  year: number
  citations: number
  evidenceLevel: string
  doiUrl: string | null
  status: 'pending' | 'done' | 'error' | 'skip'
}

type CollectState = {
  running: boolean
  query: string
  pct: number
  logs: string[]
  answer: string
  papers: PaperItem[]
  done: { added: number } | null
}

type CollectContextType = CollectState & {
  start: (query: string) => Promise<void>
  clear: () => void
}

const CollectContext = createContext<CollectContextType | null>(null)

export function CollectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CollectState>({
    running: false, query: '', pct: 0, logs: [], answer: '', papers: [], done: null
  })
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (query: string) => {
    if (state.running) return
    setState({ running: true, query, pct: 0, logs: [], answer: '', papers: [], done: null })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/search-collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            setState(prev => {
              let papers = prev.papers
              if (data.papers) papers = data.papers
              if (data.paperStatus) {
                papers = papers.map(p =>
                  p.paperId === data.paperStatus.id ? { ...p, status: data.paperStatus.status } : p
                )
              }
              return {
                ...prev,
                pct: typeof data.pct === 'number' ? data.pct : prev.pct,
                logs: data.msg ? [...prev.logs, data.msg] : prev.logs,
                answer: data.answer || prev.answer,
                papers,
                done: data.done ? { added: data.added ?? 0 } : prev.done,
                running: data.done ? false : prev.running,
              }
            })
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          running: false,
          done: { added: 0 },
          logs: [...prev.logs, `❌ 오류: ${e.message}`],
        }))
      }
    }
  }, [state.running])

  const clear = useCallback(() => {
    setState({ running: false, query: '', pct: 0, logs: [], answer: '', papers: [], done: null })
  }, [])

  return (
    <CollectContext.Provider value={{ ...state, start, clear }}>
      {children}
    </CollectContext.Provider>
  )
}

export function useCollect() {
  const ctx = useContext(CollectContext)
  if (!ctx) throw new Error('useCollect must be used within CollectProvider')
  return ctx
}
