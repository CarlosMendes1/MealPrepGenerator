'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Video, MessageCircle, MapPin } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_START  = 7;
const HOUR_END    = 21;
const HOUR_COUNT  = HOUR_END - HOUR_START;
const PX_PER_HOUR = 64;
const GRID_HEIGHT = HOUR_COUNT * PX_PER_HOUR; // 896px

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS    = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Consultation {
  id: string;
  client_id: string | null;
  client_display_name: string;
  scheduled_at: string;
  duration_min: number;
  type: 'video' | 'whatsapp' | 'in_person';
  meeting_link: string | null;
  status: string;
  notes: string | null;
}

// ── Type config ───────────────────────────────────────────────────────────────

export const TYPE_CONFIG = {
  video:     { icon: Video,         color: 'bg-indigo-100 border-indigo-300 text-indigo-800', bar: 'bg-indigo-500', label: 'Videochamada' },
  whatsapp:  { icon: MessageCircle, color: 'bg-emerald-100 border-emerald-300 text-emerald-800', bar: 'bg-emerald-500', label: 'WhatsApp' },
  in_person: { icon: MapPin,        color: 'bg-slate-100 border-slate-300 text-slate-700', bar: 'bg-slate-400', label: 'Presencial' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function minutesFromStart(date: Date): number {
  return (date.getHours() - HOUR_START) * 60 + date.getMinutes();
}

function fmt(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

// ── ConsultationBlock ─────────────────────────────────────────────────────────

function ConsultationBlock({ c, onClick }: { c: Consultation; onClick: (c: Consultation) => void }) {
  const start = new Date(c.scheduled_at);
  const mins  = minutesFromStart(start);
  const top   = (mins / 60) * PX_PER_HOUR;
  const h     = Math.max((c.duration_min / 60) * PX_PER_HOUR - 2, 20);

  const cfg  = TYPE_CONFIG[c.type] ?? TYPE_CONFIG.video;
  const Icon = cfg.icon;
  const faded = c.status === 'cancelled' || c.status === 'no_show';

  return (
    <button
      onClick={() => onClick(c)}
      style={{ top, height: h }}
      className={`absolute inset-x-0.5 rounded-lg border px-1.5 py-1 text-left hover:brightness-95 active:scale-[0.98] transition-all overflow-hidden ${cfg.color} ${faded ? 'opacity-40' : ''}`}
    >
      <div className="flex gap-1.5 h-full">
        <div className={`w-0.5 self-stretch rounded-full shrink-0 ${cfg.bar}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{c.client_display_name}</p>
          {c.duration_min >= 30 && (
            <div className="flex items-center gap-1 mt-0.5 opacity-70">
              <Icon size={9} />
              <span className="text-xs truncate">{fmtTime(start)} · {c.duration_min}min</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── WeekCalendar ──────────────────────────────────────────────────────────────

interface Props {
  consultations: Consultation[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onTodayWeek: () => void;
  onConsultationClick: (c: Consultation) => void;
  onSlotClick: (date: Date) => void;
}

export default function WeekCalendar({
  consultations, weekStart,
  onPrevWeek, onNextWeek, onTodayWeek,
  onConsultationClick, onSlotClick,
}: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const days   = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours  = useMemo(() => Array.from({ length: HOUR_COUNT }, (_, i) => HOUR_START + i), []);
  const isNow  = sameDay(getMondayOfWeek(today), weekStart);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()}–${end.getDate()} de ${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }, [weekStart]);

  // Current time indicator
  const nowMinutes = useMemo(() => {
    if (!isNow) return null;
    const n = new Date();
    const m = minutesFromStart(n);
    return m >= 0 && m <= HOUR_COUNT * 60 ? m : null;
  }, [isNow]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-900 capitalize">{weekLabel}</h2>
          {isNow && (
            <span className="text-xs bg-brand-50 text-brand-600 font-semibold px-2 py-0.5 rounded-full">
              esta semana
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!isNow && (
            <button onClick={onTodayWeek} className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition mr-1">
              Hoje
            </button>
          )}
          <button onClick={onPrevWeek} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"><ChevronLeft size={16} /></button>
          <button onClick={onNextWeek} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Day name row */}
      <div className="flex border-b border-gray-100">
        <div className="w-12 shrink-0" />
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          return (
            <div key={i} className="flex-1 py-3 text-center border-l border-gray-50">
              <p className={`text-xs font-medium ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>{DAY_NAMES[i]}</p>
              <div className={`w-8 h-8 mx-auto mt-0.5 rounded-full flex items-center justify-center ${isToday ? 'bg-brand-600' : ''}`}>
                <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.getDate()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex overflow-y-auto" style={{ maxHeight: 520 }}>
        {/* Hour labels */}
        <div className="w-12 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
          {hours.map((h) => (
            <div
              key={h}
              style={{ top: (h - HOUR_START) * PX_PER_HOUR }}
              className="absolute right-2 text-right"
            >
              <span className="text-xs text-gray-300 font-medium leading-none">{fmt(h)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, di) => {
          const dayCons = consultations.filter((c) => sameDay(new Date(c.scheduled_at), day));
          const isToday = sameDay(day, today);

          return (
            <div key={di} className="flex-1 relative border-l border-gray-50" style={{ height: GRID_HEIGHT }}>
              {/* Today highlight */}
              {isToday && <div className="absolute inset-0 bg-brand-50/20 pointer-events-none" />}

              {/* Hour lines + click zones */}
              {hours.map((h) => (
                <button
                  key={h}
                  style={{ top: (h - HOUR_START) * PX_PER_HOUR, height: PX_PER_HOUR }}
                  className="absolute inset-x-0 border-t border-gray-50 hover:bg-indigo-50/50 transition-colors w-full"
                  onClick={() => {
                    const d = new Date(day);
                    d.setHours(h, 0, 0, 0);
                    onSlotClick(d);
                  }}
                />
              ))}

              {/* Current time line */}
              {isToday && nowMinutes !== null && (
                <div
                  className="absolute inset-x-0 flex items-center pointer-events-none z-20"
                  style={{ top: (nowMinutes / 60) * PX_PER_HOUR }}
                >
                  <div className="w-2 h-2 rounded-full bg-brand-500 -ml-1 shrink-0" />
                  <div className="h-px flex-1 bg-brand-400" />
                </div>
              )}

              {/* Consultations */}
              {dayCons.map((c) => (
                <ConsultationBlock key={c.id} c={c} onClick={onConsultationClick} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
