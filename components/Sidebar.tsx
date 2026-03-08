'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const menus = [
  { href: '/review', label: '📥 검토 대기' },
  { href: '/approved', label: '✅ 승인된 카드' },
  { href: '/podcast', label: '🎙️ 데일리 팟캐스트' },
  { href: '/bank', label: '📊 콘텐츠 뱅크' },
  { href: '/study', label: '🧠 복습 & 파인만' },
  { href: '/topics', label: '⚙️ 주제 관리' },
  { href: '/collect', label: '🚀 수집 실행' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 mt-2">
      {menus.map(menu => (
        <Link
          key={menu.href}
          href={menu.href}
          onClick={() => setOpen(false)}
          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === menu.href
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {menu.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm">
        <div>
          <span className="font-bold text-slate-900">🧠 시크릿 브레인</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg hover:bg-slate-100">
          <div className="space-y-1.5">
            <span className={`block w-5 h-0.5 bg-slate-700 transition-all ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-700 transition-all ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-700 transition-all ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </header>

      {/* 모바일 드롭다운 메뉴 */}
      {open && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-lg px-4 pb-4">
          <NavLinks />
        </div>
      )}

      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-200 flex-col p-4 shadow-sm">
        <div className="mb-4 px-2">
          <h1 className="text-lg font-bold text-slate-900">🧠 시크릿 브레인</h1>
          <p className="text-xs text-slate-400 mt-0.5">인사이트 뱅크</p>
        </div>
        <NavLinks />
      </aside>
    </>
  )
}
