'use client';

import { useRouter } from 'next/navigation';
import { User, Users2 } from 'lucide-react';

interface Props {
  activeTab: 'personal' | 'team';
  orgName?: string;
}

export default function ClientsTabSwitch({ activeTab, orgName }: Props) {
  const router = useRouter();

  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      <button
        onClick={() => router.push('/dashboard/clients')}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
          activeTab === 'personal'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <User size={14} />
        Os meus clientes
      </button>
      <button
        onClick={() => router.push('/dashboard/clients?tab=team')}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
          activeTab === 'team'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Users2 size={14} />
        {orgName ?? 'Equipa'}
      </button>
    </div>
  );
}
