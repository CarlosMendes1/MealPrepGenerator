'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Settings, Users2, BarChart3, ChevronRight, CalendarDays,
} from 'lucide-react';

interface OrgContext {
  organization_id: string;
  role: string;
  organizations: { id: string; name: string };
}

interface Props {
  orgContext?: OrgContext | null;
}

const MAIN_LINKS = [
  { href: '/dashboard',               icon: LayoutDashboard, label: 'Dashboard',  exact: true },
  { href: '/dashboard/clients',       icon: Users,            label: 'Clientes' },
  { href: '/dashboard/consultations', icon: CalendarDays,     label: 'Consultas' },
  { href: '/dashboard/settings',      icon: Settings,         label: 'Definições' },
];

const TEAM_LINKS = [
  { href: '/dashboard/team',          icon: BarChart3, label: 'Visão geral' },
  { href: '/dashboard/team/members',  icon: Users2,    label: 'Membros' },
];

export default function SidebarNav({ orgContext }: Props) {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav className="flex-1 px-3 py-4 flex flex-col gap-6 overflow-y-auto">
      {/* Main */}
      <div className="space-y-0.5">
        {MAIN_LINKS.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} className={active ? 'text-brand-600' : ''} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Team section */}
      {orgContext ? (
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Equipa
            </span>
            <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded-md">
              {orgContext.role === 'owner' ? 'Owner' : orgContext.role === 'admin' ? 'Admin' : 'Membro'}
            </span>
          </div>
          <div className="mb-2 px-3">
            <p className="text-xs font-medium text-gray-700 truncate">{orgContext.organizations.name}</p>
          </div>
          <div className="space-y-0.5">
            {TEAM_LINKS.map(({ href, icon: Icon, label }) => {
              const active = isActive(href);
              // Hide "Visão geral" and "Membros" for regular members
              if (orgContext.role === 'member' && href === '/dashboard/team') return null;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-indigo-600' : ''} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mx-3">
          <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
            <Users2 size={18} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 mb-2.5 leading-relaxed">
              Gere uma equipa de nutricionistas
            </p>
            <Link
              href="/create-organization"
              className="flex items-center justify-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              Criar equipa
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
