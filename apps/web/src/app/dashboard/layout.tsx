import { LogOut } from 'lucide-react';
import SidebarNav from './SidebarNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-brand-700">NutriDesk</span>
        </div>

        <SidebarNav />

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
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
