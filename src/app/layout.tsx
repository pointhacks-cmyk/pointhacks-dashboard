import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Point Hacks',
  description: 'Point Hacks Analytics Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
