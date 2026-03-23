'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { ChevronDown, ZoomIn, X } from 'lucide-react';
import FeedbackEditor from './FeedbackEditor';

// ── Meal type config ───────────────────────────────────────────────────────────

const MEAL_TYPE_ORDER = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
  'snack',
];

const MEAL_LABELS: Record<string, string> = {
  breakfast:       'Pequeno-almoço',
  morning_snack:   'Lanche da manhã',
  lunch:           'Almoço',
  afternoon_snack: 'Lanche da tarde',
  dinner:          'Jantar',
  supper:          'Ceia',
  snack:           'Snack',
};

const MEAL_EMOJI: Record<string, string> = {
  breakfast:       '🌅',
  morning_snack:   '🍌',
  lunch:           '☀️',
  afternoon_snack: '🍎',
  dinner:          '🌙',
  supper:          '🌛',
  snack:           '🥜',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_ai: { label: 'A analisar...', color: 'bg-gray-100 text-gray-500' },
  draft:      { label: 'Rascunho pronto', color: 'bg-amber-100 text-amber-700' },
  sent:       { label: 'Feedback enviado', color: 'bg-brand-100 text-brand-700' },
};

// ── Date helpers (local-time aware) ───────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sunday
  const monday = new Date(d);
  monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, '0'),
    String(monday.getDate()).padStart(2, '0'),
  ].join('-');
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatWeekLabel(weekStart: string, isCurrent: boolean): string {
  if (isCurrent) return 'Esta semana';
  const d = new Date(weekStart + 'T12:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const startStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  const endStr = end.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  return `${startStr} – ${endStr}`;
}

function formatDayLabel(dayKey: string): string {
  const d = new Date(dayKey + 'T12:00:00');
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' });
}

// ── Grouping ───────────────────────────────────────────────────────────────────

type Meal = Record<string, any>;

interface TypeGroup { mealType: string; meals: Meal[] }
interface DayGroup  { dayKey: string; typeGroups: TypeGroup[] }
interface WeekGroup { weekStart: string; days: DayGroup[]; totalMeals: number }

function sortByType(a: string, b: string): number {
  const ia = MEAL_TYPE_ORDER.indexOf(a);
  const ib = MEAL_TYPE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function groupMeals(meals: Meal[]): WeekGroup[] {
  // week → day → mealType → Meal[]
  const map: Record<string, Record<string, Record<string, Meal[]>>> = {};

  for (const meal of meals) {
    const w = getWeekStart(meal.eaten_at);
    const d = getDayKey(meal.eaten_at);
    if (!map[w]) map[w] = {};
    if (!map[w][d]) map[w][d] = {};
    if (!map[w][d][meal.meal_type]) map[w][d][meal.meal_type] = [];
    map[w][d][meal.meal_type].push(meal);
  }

  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, daysMap]) => {
      const days: DayGroup[] = Object.entries(daysMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dayKey, typeMap]) => {
          const typeGroups: TypeGroup[] = Object.entries(typeMap)
            .sort(([a], [b]) => sortByType(a, b))
            .map(([mealType, meals]) => ({
              mealType,
              meals: [...meals].sort(
                (x, y) => new Date(x.eaten_at).getTime() - new Date(y.eaten_at).getTime()
              ),
            }));
          return { dayKey, typeGroups };
        });

      const totalMeals = days.reduce(
        (n, d) => n + d.typeGroups.reduce((m, g) => m + g.meals.length, 0), 0
      );
      return { weekStart, days, totalMeals };
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  meals: Meal[];
  token: string;
}

export default function MealsSection({ meals, token }: Props) {
  const currentWeekStart = useMemo(() => getWeekStart(new Date().toISOString()), []);
  const grouped = useMemo(() => groupMeals(meals), [meals]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([currentWeekStart]));
  const [lightbox, setLightbox] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, closeLightbox]);

  function toggleWeek(w: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(w) ? next.delete(w) : next.add(w);
      return next;
    });
  }

  if (meals.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
        Ainda sem refeições registadas.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {grouped.map(({ weekStart, days, totalMeals }) => {
          const isCurrent = weekStart === currentWeekStart;
          const isOpen = expanded.has(weekStart);

          return (
            <div key={weekStart} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Week accordion header */}
              <button
                onClick={() => toggleWeek(weekStart)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-gray-900 text-sm">
                    {formatWeekLabel(weekStart, isCurrent)}
                  </span>
                  {isCurrent && (
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                      atual
                    </span>
                  )}
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {totalMeals} refeição{totalMeals !== 1 ? 'ões' : ''}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Week body */}
              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {days.map(({ dayKey, typeGroups }) => (
                    <div key={dayKey}>
                      {/* Day header */}
                      <div className="px-5 py-2.5 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 capitalize">
                          {formatDayLabel(dayKey)}
                        </p>
                      </div>

                      {/* Meal type sections */}
                      {typeGroups.map(({ mealType, meals: typeMeals }) => (
                        <div key={mealType}>
                          {/* Meal type header */}
                          <div className="px-5 py-2 flex items-center gap-2 bg-white border-b border-gray-50">
                            <span className="text-sm">{MEAL_EMOJI[mealType] ?? '🍽️'}</span>
                            <span className="text-xs font-semibold text-gray-500">
                              {MEAL_LABELS[mealType] ?? mealType}
                            </span>
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="text-xs text-gray-400">
                              {typeMeals.length} {typeMeals.length !== 1 ? 'registos' : 'registo'}
                            </span>
                          </div>

                          {/* Meals */}
                          <div className="divide-y divide-gray-50">
                            {typeMeals.map((meal) => {
                              const status = STATUS_LABELS[meal.feedback_status] ?? STATUS_LABELS.pending_ai;
                              const analysis = meal.ai_analysis;

                              return (
                                <div key={meal.id}>
                                  <div className="flex gap-4 p-4">
                                    {/* Thumbnail */}
                                    <button
                                      onClick={() => setLightbox(meal.photo_url)}
                                      className="group relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                      aria-label="Ver imagem ampliada"
                                    >
                                      <Image src={meal.photo_url} alt="Refeição" fill className="object-cover" />
                                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors">
                                        <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                      </span>
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                                          {status.label}
                                        </span>
                                      </div>

                                      <p className="text-xs text-gray-400 mb-3">
                                        {new Date(meal.eaten_at).toLocaleString('pt-PT', {
                                          hour: '2-digit', minute: '2-digit',
                                        })}
                                      </p>

                                      {meal.client_notes && (
                                        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 mb-3 leading-relaxed">
                                          <span className="font-medium text-blue-600">Notas: </span>
                                          {meal.client_notes}
                                        </p>
                                      )}

                                      {analysis && (
                                        <div className="flex flex-wrap gap-2 text-xs">
                                          {[
                                            { label: 'kcal',  value: analysis.macros.calories },
                                            { label: 'prot',  value: `${analysis.macros.protein_g}g` },
                                            { label: 'hidr',  value: `${analysis.macros.carbs_g}g` },
                                            { label: 'gord',  value: `${analysis.macros.fat_g}g` },
                                            { label: 'score', value: `${analysis.score}/10` },
                                          ].map((m) => (
                                            <div key={m.label} className="bg-gray-50 rounded px-2 py-1 text-center">
                                              <p className="font-semibold text-gray-700">{m.value}</p>
                                              <p className="text-gray-400">{m.label}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {analysis?.summary && (
                                    <div className="px-4 pb-2">
                                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                                        <span className="font-medium text-gray-600">IA: </span>
                                        {analysis.summary}
                                      </p>
                                    </div>
                                  )}

                                  {analysis?.foods?.length > 0 && (
                                    <div className="px-4 pb-2">
                                      <div className="flex flex-wrap gap-1.5">
                                        {analysis.foods.map((food: any, i: number) => (
                                          <span key={i} className="text-xs bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                                            {food.name} ({food.portion_g}g)
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <FeedbackEditor
                                    mealId={meal.id}
                                    aiDraft={meal.ai_feedback_draft}
                                    currentFeedback={meal.nutritionist_feedback}
                                    status={meal.feedback_status}
                                    token={token}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          <div
            className="relative w-full max-w-3xl mx-4 rounded-xl overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox}
              alt="Refeição"
              width={1200}
              height={900}
              className="w-full max-h-[85vh] object-contain"
              priority
            />
          </div>
        </div>
      )}
    </>
  );
}
