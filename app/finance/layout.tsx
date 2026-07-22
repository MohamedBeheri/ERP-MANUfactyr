import { AppLayout } from '@/components/app-layout'
import { ReportNav } from '@/components/report-nav'

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row min-h-dvh">
        <ReportNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </AppLayout>
  )
}
