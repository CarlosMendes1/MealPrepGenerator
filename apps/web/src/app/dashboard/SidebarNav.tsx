'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, LayoutDashboard, Settings } from 'lucide-react';

const LINKS = [
  { href: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/clients',  icon: Users,            label: 'Clientes' },
  { href: '/dashboard/settings', icon: Settings,         label: 'Definições' },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {LINKS.map(({ href, icon: Icon, label }) => {
        const isActive =
          href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-brand-600' : ''} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
