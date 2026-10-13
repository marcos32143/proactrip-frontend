// app/admin/layout.tsx
// Layout protegido: el proxy (src/proxy.ts) ya maneja la redirección por falta de auth.
// Acá solo validamos el permiso users:read según DASHBOARD_API.md.

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AdminSidebar from '@/components/admin/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [redirected, setRedirected] = useState(false);

  const canAccessDashboard = user?.permissions?.includes('users:read') || user?.role_name === 'admin';

  useEffect(() => {
    if (isLoading || redirected) return;

    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- navigation guard sets redirect flag before router.replace
      setRedirected(true);
      router.replace('/auth/login?redirect=/admin&reason=session_expired');
      return;
    }

    if (!canAccessDashboard) {
      setRedirected(true);
      router.replace('/');
      return;
    }
  }, [isAuthenticated, canAccessDashboard, isLoading, redirected, router]);

  if (isLoading || !isAuthenticated || !canAccessDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <AdminSidebar />
      <main className="flex-1 ml-60 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          }>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
