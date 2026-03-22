'use client';

import { useState } from 'react';
import { Wand2, Send, Check } from 'lucide-react';

interface Props {
  mealId: string;
  aiDraft: string | null;
  currentFeedback: string | null;
  status: string;
  token: string;
}

export default function FeedbackEditor({ mealId, aiDraft, currentFeedback, status, token }: Props) {
  const [text, setText] = useState(currentFeedback ?? aiDraft ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(status === 'sent');
  const [expanded, setExpanded] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  function useAiDraft() {
    setText(aiDraft ?? '');
    setExpanded(true);
  }

  async function sendFeedback() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/meals/${mealId}/feedback`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: text }),
      });
      if (res.ok) setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2.5 text-sm">
          <Check size={14} className="text-brand-600 flex-shrink-0" />
          <p className="text-gray-600">{text}</p>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="px-4 pb-4 flex gap-2">
        {aiDraft && (
          <button
            onClick={useAiDraft}
            className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition"
          >
            <Wand2 size={12} />
            Usar rascunho IA
          </button>
        )}
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          Escrever feedback
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        placeholder="Escreva o seu feedback aqui..."
      />
      <div className="flex justify-between items-center mt-2">
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          cancelar
        </button>
        <div className="flex gap-2">
          {aiDraft && text !== aiDraft && (
            <button
              onClick={useAiDraft}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg"
            >
              <Wand2 size={12} />
              Repor IA
            </button>
          )}
          <button
            onClick={sendFeedback}
            disabled={sending || !text.trim()}
            className="flex items-center gap-1.5 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition disabled:opacity-60"
          >
            <Send size={12} />
            {sending ? 'A enviar...' : 'Enviar feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
