import { Sidebar } from '@/components/layout/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50 print:block print:h-auto print:overflow-visible print:bg-white">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ImpersonationBanner />
          <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
