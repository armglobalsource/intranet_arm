import { Sidebar } from '@/components/layout/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-[100dvh] overflow-hidden bg-gray-50 pt-14 md:pt-0 print:block print:h-auto print:overflow-visible print:bg-white print:pt-0">
        <Sidebar />
        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
          <ImpersonationBanner />
          <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
      <FeedbackWidget />
    </AuthGuard>
  );
}
