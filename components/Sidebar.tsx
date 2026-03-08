'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menus = [
  { href: '/review', label: '📥 검토 대기' },
  { href: '/approved', label: '✅ 승인된 카드' },
  { href: '/bank', label: '📊 콘텐츠 뱅크' },
  { href: '/study', label: '🧠 복습 & 파인만' },
  { href: '/reader', label: '📖 논문 원문 읽기' },
  { href: '/topics', label: '⚙️ 주제 관리' },
  { href: '/collect', label: '🚀 수집 실행' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">🧠 시크릿 브레인</h1>
        <p className="text-xs text-gray-400 mt-1">인사이트 뱅크</p>
      </div>

      <nav className="flex flex-col gap-1">
        {menus.map(menu => (
          <Link
            key={menu.href}
            href={menu.href}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === menu.href
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {menu.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
