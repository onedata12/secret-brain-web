'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const menus = [
  { href: '/collect', label: '검색', icon: '🔍', short: '검색' },
  { href: '/review', label: '검토 대기', icon: '📥', short: '검토' },
  { href: '/approved', label: '승인 카드', icon: '✅', short: '카드' },
  { href: '/study', label: '복습 & 파인만', icon: '🧠', short: '공부' },
  { href: '/podcast', label: '팟캐스트', icon: '🎙️', short: '팟캐스트' },
  { href: '/bank', label: '콘텐츠 뱅크', icon: '📊', short: '뱅크' },
  { href: '/topics', label: '주제 관리', icon: '⚙️', short: '주제' },
]

// 모바일 하단 탭에 보일 핵심 메뉴 (5개까지)
const mobileMenus = [
  { href: '/collect', icon: '🔍', short: '검색' },
  { href: '/review', icon: '📥', short: '검토' },
  { href: '/approved', icon: '✅', short: '카드' },
  { href: '/study', icon: '🧠', short: '공부' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreMenus = menus.filter(m => !mobileMenus.find(mm => mm.href === m.href))

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100 px-4 h-12 flex items-center">
        <span className="font-bold text-slate-900 text-sm">🧠 시크릿 브레인</span>
      </header>

      {/* 모바일 하단 탭 네비게이션 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-slate-100">
        <div className="flex items-stretch">
          {mobileMenus.map(menu => (
            <Link
              key={menu.href}
              href={menu.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
                pathname === menu.href
                  ? 'text-indigo-600'
                  : 'text-slate-400'
              }`}
            >
              <span className="text-lg leading-none">{menu.icon}</span>
              <span className="text-[10px] mt-0.5 font-medium">{menu.short}</span>
            </Link>
          ))}
          {/* 더보기 */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors ${
              moreOpen || moreMenus.some(m => pathname === m.href) ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            <span className="text-lg leading-none">•••</span>
            <span className="text-[10px] mt-0.5 font-medium">더보기</span>
          </button>
        </div>

        {/* 더보기 패널 */}
        {moreOpen && (
          <div className="absolute bottom-full left-0 right-0 bg-white border-t border-slate-100 shadow-lg rounded-t-2xl px-4 py-3 animate-slide-up">
            <div className="flex gap-2 flex-wrap">
              {moreMenus.map(menu => (
                <Link
                  key={menu.href}
                  href={menu.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    pathname === menu.href
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-slate-50 text-slate-600 active:bg-slate-100'
                  }`}
                >
                  <span>{menu.icon}</span>
                  <span>{menu.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-100 flex-col p-4">
        <div className="mb-6 px-2">
          <h1 className="text-lg font-bold text-slate-900">🧠 시크릿 브레인</h1>
          <p className="text-xs text-slate-400 mt-0.5">인사이트 뱅크</p>
        </div>
        <nav className="flex flex-col gap-0.5">
          {menus.map(menu => (
            <Link
              key={menu.href}
              href={menu.href}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === menu.href
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {menu.icon} {menu.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
