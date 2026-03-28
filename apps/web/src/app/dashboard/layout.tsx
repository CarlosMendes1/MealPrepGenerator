import { LogOut } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import SidebarNav from './SidebarNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getOrgContext(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/organizations/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as { organization_id: string; role: string; organizations: { id: string; name: string } } | null;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await getAuthenticatedUser();
  const { data: { session } } = await supabase.auth.getSession();

  const orgContext = session ? await getOrgContext(session.access_token) : null;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-brand-700">NutriDesk</span>
        </div>

        <SidebarNav orgContext={orgContext} />

        <div className="px-3 py-4 border-t border-gray-100">
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition"
            >
              <LogOut size={16} />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
    </div>
  );
}
