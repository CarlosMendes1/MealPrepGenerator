import Link from 'next/link';
import { Users, LayoutDashboard, Settings, LogOut } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-brand-700">NutriDesk</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <SideLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
          <SideLink href="/dashboard/clients" icon={<Users size={16} />} label="Clientes" />
          <SideLink href="/dashboard/settings" icon={<Settings size={16} />} label="Definições" />
        </nav>

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

function SideLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition"
    >
      {icon}
      {label}
    </Link>
  );
}
