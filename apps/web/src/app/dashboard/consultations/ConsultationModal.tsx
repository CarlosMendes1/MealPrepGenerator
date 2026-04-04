'use client';

import { useState, useEffect } from 'react';
import { X, Video, MessageCircle, MapPin, Trash2, ExternalLink, Check } from 'lucide-react';
import type { Consultation } from './WeekCalendar';
import { TYPE_CONFIG } from './WeekCalendar';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Client { user_id: string; full_name: string }

interface Props {
  mode: 'create' | 'edit';
  consultation?: Consultation | null;
  initialDate?: Date | null;
  clients: Client[];
  token: string;
  onClose: () => void;
  onSave: (c: Consultation) => void;
  onDelete?: (id: string) => void;
}

const TYPE_OPTIONS = [
  { key: 'video'    as const, label: 'Videochamada', icon: Video,         placeholder: 'https://meet.google.com/xxx ou zoom.us/j/...' },
  { key: 'whatsapp' as const, label: 'WhatsApp',     icon: MessageCircle, placeholder: 'https://wa.me/351XXXXXXXXX' },
  { key: 'in_person'as const, label: 'Presencial',   icon: MapPin,        placeholder: 'Morada (opcional)' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const STATUS_OPTIONS = [
  { key: 'scheduled',  label: 'Agendada' },
  { key: 'completed',  label: 'Realizada' },
  { key: 'cancelled',  label: 'Cancelada' },
  { key: 'no_show',    label: 'Falta' },
];

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ConsultationModal({
  mode, consultation, initialDate, clients, token, onClose, onSave, onDelete,
}: Props) {
  const [clientId,   setClientId]   = useState(consultation?.client_id ?? '');
  const [clientName, setClientName] = useState(consultation?.client_display_name ?? '');
  const [datetime,   setDatetime]   = useState(() => {
    if (consultation) return toLocalDatetimeInput(new Date(consultation.scheduled_at));
    if (initialDate)  return toLocalDatetimeInput(initialDate);
    return toLocalDatetimeInput(new Date());
  });
  const [duration, setDuration] = useState(consultation?.duration_min ?? 60);
  const [type,     setType]     = useState<'video'|'whatsapp'|'in_person'>(consultation?.type ?? 'video');
  const [link,     setLink]     = useState(consultation?.meeting_link ?? '');
  const [notes,    setNotes]    = useState(consultation?.notes ?? '');
  const [status,   setStatus]   = useState(consultation?.status ?? 'scheduled');
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  const selectedClient = clients.find((c) => c.user_id === clientId);
  const displayName = selectedClient?.full_name ?? clientName;

  async function save() {
    if (!displayName.trim()) { setError('Adiciona o nome do cliente.'); return; }
    if (!datetime) { setError('Seleciona a data e hora.'); return; }
    setSaving(true); setError('');

    const body = {
      client_id:    clientId || null,
      client_name:  clientId ? null : clientName.trim() || null,
      scheduled_at: new Date(datetime).toISOString(),
      duration_min: duration,
      type,
      meeting_link: link.trim() || null,
      notes:        notes.trim() || null,
      status,
    };

    try {
      const url = mode === 'create'
        ? `${API_URL}/api/consultations`
        : `${API_URL}/api/consultations/${consultation!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : 'Erro ao guardar.';
        setError(errMsg);
        return;
      }

      onSave({
        ...data,
        client_display_name: selectedClient?.full_name ?? clientName.trim() ?? 'Cliente',
      });
    } catch {
      setError('Erro de ligação.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteConsultation() {
    if (!consultation || !confirm('Eliminar esta consulta?')) return;
    setDeleting(true);
    try {
      await fetch(`${API_URL}/api/consultations/${consultation.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onDelete?.(consultation.id);
    } finally {
      setDeleting(false);
    }
  }

  const typeCfg = TYPE_CONFIG[type];
  const linkPlaceholder = TYPE_OPTIONS.find((t) => t.key === type)?.placeholder ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">
            {mode === 'create' ? 'Nova consulta' : 'Editar consulta'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Client */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cliente</label>
            {clients.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setClientName(''); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Selecionar cliente da lista —</option>
                  {clients.map((c) => (
                    <option key={c.user_id} value={c.user_id}>{c.full_name}</option>
                  ))}
                  <option value="__manual">Outro (introduzir manualmente)</option>
                </select>
                {(clientId === '__manual' || (!clientId && clientName)) && (
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => { setClientName(e.target.value); setClientId(''); }}
                    placeholder="Nome do cliente"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {/* Date + duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data e hora</label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Duração</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d < 60 ? `${d} min` : `${d/60}h${d%60 ? ` ${d%60}min` : ''}`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de consulta</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-sm ${
                    type === key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Meeting link */}
          {type !== 'in_person' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {type === 'video' ? 'Link da reunião' : 'Link WhatsApp'}
              </label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={linkPlaceholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {type === 'whatsapp' && (
                <p className="text-xs text-gray-400 mt-1">
                  Formato: <span className="font-mono">https://wa.me/351XXXXXXXXX</span>
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Notas internas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Revisão do plano alimentar, análises..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Status (edit mode) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Estado</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatus(key)}
                    className={`flex items-center gap-2 py-2 px-3 rounded-xl border-2 text-sm transition-all ${
                      status === key
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {status === key && <Check size={13} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2 shrink-0">
          {mode === 'edit' && onDelete && (
            <button
              onClick={deleteConsultation}
              disabled={deleting}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              title="Eliminar consulta"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition"
          >
            {saving ? 'A guardar...' : mode === 'create' ? 'Criar consulta' : 'Guardar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
