import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { CollectProvider } from '@/context/CollectContext'
import CollectProgress from '@/components/CollectProgress'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '시크릿 브레인 인사이트 뱅크',
  description: '논문 기반 콘텐츠 자동화',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-slate-50 text-slate-900 min-h-screen`}>
        <CollectProvider>
          <Sidebar />
          <main className="md:ml-60 p-4 md:p-6 pt-16 md:pt-6 min-h-screen">
            {children}
          </main>
          <CollectProgress />
        </CollectProvider>
      </body>
    </html>
  )
}
