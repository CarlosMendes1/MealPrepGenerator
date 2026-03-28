'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, CalendarDays, Clock, Video, MessageCircle, MapPin, ExternalLink } from 'lucide-react';
import WeekCalendar, {
  type Consultation,
  getMondayOfWeek,
  addDays,
  sameDay,
  TYPE_CONFIG,
} from './WeekCalendar';
import ConsultationModal from './ConsultationModal';

interface Client { user_id: string; full_name: string }

interface Props {
  initialConsultations: Consultation[];
  clients: Client[];
  token: string;
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Upcoming consultation card ────────────────────────────────────────────────

function UpcomingCard({ c, onClick }: { c: Consultation; onClick: (c: Consultation) => void }) {
  const start = new Date(c.scheduled_at);
  const end   = new Date(start.getTime() + c.duration_min * 60_000);
  const cfg   = TYPE_CONFIG[c.type] ?? TYPE_CONFIG.video;
  const Icon  = cfg.icon;
  const faded = c.status === 'cancelled' || c.status === 'no_show';

  return (
    <button
      onClick={() => onClick(c)}
      className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group ${faded ? 'opacity-50' : ''}`}
    >
      {/* Type color bar */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${cfg.bar}`} />

      {/* Time column */}
      <div className="shrink-0 w-16 text-center">
        <p className="text-sm font-bold text-gray-900">{fmtTime(start)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{fmtTime(end)}</p>
        <p className="text-xs text-gray-300 mt-1">{c.duration_min}min</p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
          {c.client_display_name}
        </p>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
          <Icon size={11} />
          <span>{cfg.label}</span>
        </div>
        {c.notes && (
          <p className="text-xs text-gray-400 mt-1.5 truncate">{c.notes}</p>
        )}
      </div>

      {/* Link button */}
      {c.meeting_link && (
        <a
          href={c.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition"
          title="Abrir link"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </button>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  scheduled:  'bg-blue-50 text-blue-700',
  completed:  'bg-green-50 text-green-700',
  cancelled:  'bg-red-50 text-red-600',
  no_show:    'bg-orange-50 text-orange-600',
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', completed: 'Realizada', cancelled: 'Cancelada', no_show: 'Falta',
};

// ── ConsultationsClient ───────────────────────────────────────────────────────

export default function ConsultationsClient({ initialConsultations, clients, token }: Props) {
  const [consultations, setConsultations] = useState<Consultation[]>(initialConsultations);
  const [weekStart,     setWeekStart]     = useState(() => getMondayOfWeek(new Date()));

  // Modal state
  const [modalOpen,         setModalOpen]         = useState(false);
  const [modalMode,         setModalMode]         = useState<'create' | 'edit'>('create');
  const [editConsultation,  setEditConsultation]  = useState<Consultation | null>(null);
  const [modalInitialDate,  setModalInitialDate]  = useState<Date | null>(null);

  // ── Week navigation ────────────────────────────────────────────────────────
  const handlePrevWeek  = useCallback(() => setWeekStart((d) => addDays(d, -7)), []);
  const handleNextWeek  = useCallback(() => setWeekStart((d) => addDays(d, 7)), []);
  const handleTodayWeek = useCallback(() => setWeekStart(getMondayOfWeek(new Date())), []);

  // ── Slot click → open create modal ────────────────────────────────────────
  const handleSlotClick = useCallback((date: Date) => {
    setModalMode('create');
    setEditConsultation(null);
    setModalInitialDate(date);
    setModalOpen(true);
  }, []);

  // ── Consultation click → open edit modal ──────────────────────────────────
  const handleConsultationClick = useCallback((c: Consultation) => {
    setModalMode('edit');
    setEditConsultation(c);
    setModalInitialDate(null);
    setModalOpen(true);
  }, []);

  // ── New button ─────────────────────────────────────────────────────────────
  const handleNewClick = useCallback(() => {
    setModalMode('create');
    setEditConsultation(null);
    setModalInitialDate(null);
    setModalOpen(true);
  }, []);

  // ── Save (create or update) ────────────────────────────────────────────────
  const handleSave = useCallback((saved: Consultation) => {
    setConsultations((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModalOpen(false);
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    setConsultations((prev) => prev.filter((c) => c.id !== id));
    setModalOpen(false);
  }, []);

  // ── Week consultations (for calendar) ─────────────────────────────────────
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const weekConsultations = useMemo(() =>
    consultations.filter((c) => {
      const d = new Date(c.scheduled_at);
      return d >= weekStart && d < weekEnd;
    }),
    [consultations, weekStart, weekEnd]
  );

  // ── Upcoming consultations (after current displayed week) ─────────────────
  const upcomingGroups = useMemo(() => {
    const now = new Date();
    const upcoming = consultations
      .filter((c) => new Date(c.scheduled_at) >= weekEnd)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

    // Group by day
    const groups: Array<{ dateKey: string; label: string; items: Consultation[] }> = [];
    for (const c of upcoming) {
      const day = new Date(c.scheduled_at);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();
      let group = groups.find((g) => g.dateKey === key);
      if (!group) {
        group = { dateKey: key, label: capitalize(fmtDate(day)), items: [] };
        groups.push(group);
      }
      group.items.push(c);
    }
    return groups;
  }, [consultations, weekEnd]);

  // ── Stats for header ───────────────────────────────────────────────────────
  const thisWeekCount = useMemo(() => {
    const monday = getMondayOfWeek(new Date());
    const sunday = addDays(monday, 7);
    return consultations.filter((c) => {
      const d = new Date(c.scheduled_at);
      return d >= monday && d < sunday && c.status !== 'cancelled' && c.status !== 'no_show';
    }).length;
  }, [consultations]);

  const upcomingCount = upcomingGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="min-h-full bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultas</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Agenda e gestão de consultas
            </p>
          </div>
          <button
            onClick={handleNewClick}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm shadow-indigo-200"
          >
            <Plus size={16} />
            Nova consulta
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Esta semana</p>
            <p className="text-2xl font-bold text-gray-900">{thisWeekCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">consultas agendadas</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Próximas</p>
            <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">nas próximas semanas</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-900">{consultations.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">no período visível</p>
          </div>
        </div>

        {/* Week calendar */}
        <WeekCalendar
          consultations={weekConsultations}
          weekStart={weekStart}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onTodayWeek={handleTodayWeek}
          onConsultationClick={handleConsultationClick}
          onSlotClick={handleSlotClick}
        />

        {/* Upcoming consultations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays size={18} className="text-gray-400" />
              Próximas consultas
            </h2>
            {upcomingCount > 0 && (
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                {upcomingCount}
              </span>
            )}
          </div>

          {upcomingGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
              <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">Sem consultas agendadas</p>
              <p className="text-gray-300 text-xs mt-1">Clica num slot do calendário ou em "Nova consulta"</p>
            </div>
          ) : (
            <div className="space-y-6">
              {upcomingGroups.map((group) => (
                <div key={group.dateKey}>
                  {/* Day label */}
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-xs font-semibold text-gray-500">{group.label}</p>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-300">{group.items.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                    {group.items.map((c) => (
                      <div key={c.id} className="px-2 py-1">
                        <UpcomingCard c={c} onClick={handleConsultationClick} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal */}
      {modalOpen && (
        <ConsultationModal
          mode={modalMode}
          consultation={editConsultation}
          initialDate={modalInitialDate}
          clients={clients}
          token={token}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
