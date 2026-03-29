'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

export default function BillingToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get('billing');

  useEffect(() => {
    if (!status) return;
    // Clean URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('billing');
    router.replace(url.pathname, { scroll: false });
  }, [status, router]);

  if (!status) return null;

  const success = status === 'success';

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 ${
      success ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
    }`}>
      {success
        ? <CheckCircle size={18} className="shrink-0" />
        : <XCircle size={18} className="shrink-0" />
      }
      {success
        ? 'Subscrição ativada com sucesso!'
        : 'Pagamento cancelado. Podes tentar novamente.'}
    </div>
  );
}
