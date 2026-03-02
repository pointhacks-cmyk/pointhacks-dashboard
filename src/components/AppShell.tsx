'use client'

import AuthGate from '@/components/AuthGate'
import Sidebar from '@/components/Sidebar'
import MobileTopBar from '@/components/MobileTopBar'
import DateRangeSelector from '@/components/DateRangeSelector'
import { DateRangeProvider } from '@/lib/DateRangeContext'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <DateRangeProvider>
        <Sidebar />
        <MobileTopBar />
        <main
          style={{ padding: '24px 16px', minHeight: '100vh' }}
        >
          <style>{`
            @media (min-width: 768px) {
              main { padding: 32px !important; }
            }
            @media (max-width: 767px) {
              main { padding-top: 72px !important; }
            }
          `}</style>
          <DateRangeSelector />
          {children}
        </main>
      </DateRangeProvider>
    </AuthGate>
  )
}
