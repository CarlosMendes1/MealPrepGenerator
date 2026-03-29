'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Props {
  plan: 'pro_monthly' | 'pro_annual';
  token: string;
  label: string;
  highlight?: boolean;
  disabled?: boolean;
}

export default function BillingButton({ plan, token, label, highlight, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/individual/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 ${
        disabled
          ? 'bg-gray-100 text-gray-500 cursor-default'
          : highlight
          ? 'bg-brand-600 hover:bg-brand-700 text-white'
          : 'bg-gray-900 hover:bg-gray-800 text-white'
      }`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : label}
    </button>
  );
}
