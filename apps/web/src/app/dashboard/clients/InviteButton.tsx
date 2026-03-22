'use client';

import { useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';

interface Props {
  token: string;
  variant?: 'default' | 'primary';
}

export default function InviteButton({ token, variant = 'default' }: Props) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setCode(data.code);
      setShow(true);
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (show && code) {
    return (
      <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2">
        <span className="text-sm text-gray-500">Código:</span>
        <span className="font-mono font-bold text-brand-700 text-lg tracking-widest">{code}</span>
        <button onClick={copyCode} className="ml-2 text-brand-600 hover:text-brand-800">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <button
          onClick={() => { setShow(false); setCode(null); }}
          className="ml-2 text-xs text-gray-400 hover:text-gray-600"
        >
          fechar
        </button>
      </div>
    );
  }

  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={generate}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 ${
        isPrimary
          ? 'bg-brand-600 text-white hover:bg-brand-700'
          : 'bg-brand-600 text-white hover:bg-brand-700'
      }`}
    >
      <Plus size={16} />
      {loading ? 'A gerar...' : 'Gerar código convite'}
    </button>
  );
}
