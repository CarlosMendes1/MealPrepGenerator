'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Props {
  plan: 'coach_monthly' | 'coach_annual';
  token: string;
  label: string;
  active?: boolean;
}

export default function CoachBillingButton({ plan, token, label, active }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (active) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/coach/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  if (active) {
    return (
      <div className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
        Ativo
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : label}
    </button>
  );
}
