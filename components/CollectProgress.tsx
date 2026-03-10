'use client'
import { useCollect } from '@/context/CollectContext'
import { useRouter } from 'next/navigation'

export default function CollectProgress() {
  const { running, pct, logs, done, query, clear, abort } = useCollect()
  const router = useRouter()

  if (!running && !done) return null

  const lastLog = logs[logs.length - 1] || ''

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
            {running ? `🔍 "${query}" 수집 중...`
              : done?.added ? `✅ ${done.added}개 카드 추가 완료`
              : '완료 (새 논문 없음)'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {running && (
              <button onClick={abort}
                className="text-xs bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg">
                ⏹ 중단
              </button>
            )}
            {done?.added ? (
              <button onClick={() => { router.push('/review'); clear() }}
                className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700">
                검토하러 가기 →
              </button>
            ) : null}
            {!running && (
              <button onClick={clear} className="text-xs text-slate-400 hover:text-slate-600 px-1">✕</button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="truncate max-w-[220px]">{lastLog}</span>
            <span className="font-medium text-indigo-500 shrink-0 ml-2">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${
              !running && done?.added ? 'bg-green-500' : 'bg-indigo-500'
            }`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
