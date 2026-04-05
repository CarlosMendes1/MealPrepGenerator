import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Clock } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { timeAgo } from '@/utils/time';
import { MealsSkeleton } from '@/components/Skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Meal {
  id: string;
  photo_url: string | null;
  meal_type: string;
  eaten_at: string;
  feedback_status: string;
  nutritionist_feedback: string | null;
  ai_analysis: {
    macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    score: number;
    summary: string;
    foods: Array<{ name: string; portion_g: number }>;
  } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEAL_TYPE_ORDER: string[] = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper', 'snack',
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
  breakfast: '🌅', morning_snack: '🍌', lunch: '☀️',
  afternoon_snack: '🍎', dinner: '🌙', supper: '🌛', snack: '🥜',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_ai: { label: 'A analisar...', bg: 'bg-gray-100', text: 'text-gray-500' },
  draft:      { label: 'Aguarda revisão', bg: 'bg-amber-100', text: 'text-amber-700' },
  sent:       { label: 'Feedback recebido', bg: 'bg-brand-100', text: 'text-brand-700' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="bg-gray-50 rounded-lg px-2 py-1 items-center">
      <Text className="text-xs font-bold text-gray-700">{value}</Text>
      <Text className="text-xs text-gray-400">{label}</Text>
    </View>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const status = STATUS_CONFIG[meal.feedback_status] ?? STATUS_CONFIG.pending_ai;

  return (
    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Photo + macros row */}
      <View className="flex-row gap-3 p-4">
        {meal.photo_url ? (
          <Image source={{ uri: meal.photo_url }} className="w-28 h-28 rounded-xl" resizeMode="cover" />
        ) : (
          <View className="w-28 h-28 rounded-xl bg-slate-100 items-center justify-center">
            <Text className="text-4xl">📝</Text>
          </View>
        )}

        <View className="flex-1">
          {/* Time + status */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1">
              <Clock size={11} color="#9ca3af" />
              <Text className="text-xs text-gray-400">{timeAgo(meal.eaten_at)}</Text>
            </View>
            <View className={`px-2 py-0.5 rounded-full ${status.bg}`}>
              <Text className={`text-xs font-medium ${status.text}`}>{status.label}</Text>
            </View>
          </View>

          {/* Macros */}
          {meal.ai_analysis && (
            <View className="flex-row gap-2 mt-1">
              <MacroBadge label="kcal"  value={meal.ai_analysis.macros.calories} />
              <MacroBadge label="prot"  value={`${meal.ai_analysis.macros.protein_g}g`} />
              <MacroBadge label="score" value={`${meal.ai_analysis.score}/10`} />
            </View>
          )}
        </View>
      </View>

      {/* Food tags */}
      {meal.ai_analysis?.foods && meal.ai_analysis.foods.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 px-4 pb-3">
          {meal.ai_analysis.foods.slice(0, 4).map((food, i) => (
            <View key={i} className="bg-brand-50 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-brand-700">{food.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Nutritionist feedback */}
      {meal.feedback_status === 'sent' && meal.nutritionist_feedback && (
        <View className="mx-4 mb-4 bg-brand-50 rounded-xl p-3">
          <View className="flex-row items-center gap-1.5 mb-1">
            <MessageSquare size={12} color="#16a34a" />
            <Text className="text-xs font-semibold text-brand-700">Feedback</Text>
          </View>
          <Text className="text-sm text-gray-700">{meal.nutritionist_feedback}</Text>
        </View>
      )}
    </View>
  );
}

function MealTypeSection({ mealType, meals }: { mealType: string; meals: Meal[] }) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2 px-1">
        <Text className="text-base">{MEAL_EMOJI[mealType] ?? '🍽️'}</Text>
        <Text className="text-xs font-semibold text-gray-600">{MEAL_LABELS[mealType] ?? mealType}</Text>
        <View className="flex-1 h-px bg-gray-200 ml-1" />
      </View>
      <View className="space-y-2">
        {meals.map((meal) => <MealCard key={meal.id} meal={meal} />)}
      </View>
    </View>
  );
}

function DaySection({ dateLabel, typeGroups }: {
  dateLabel: string;
  typeGroups: Array<{ mealType: string; meals: Meal[] }>;
}) {
  return (
    <View className="mb-6">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 capitalize">
        {dateLabel}
      </Text>
      {typeGroups.map(({ mealType, meals }) => (
        <MealTypeSection key={mealType} mealType={mealType} meals={meals} />
      ))}
    </View>
  );
}

// ── Grouping logic ────────────────────────────────────────────────────────────

function groupMeals(meals: Meal[]): Array<{
  dateLabel: string;
  dateKey: string;
  typeGroups: Array<{ mealType: string; meals: Meal[] }>;
}> {
  const byDate: Record<string, Record<string, Meal[]>> = {};

  for (const meal of meals) {
    const d = new Date(meal.eaten_at);
    const dateKey = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');

    if (!byDate[dateKey]) byDate[dateKey] = {};
    if (!byDate[dateKey][meal.meal_type]) byDate[dateKey][meal.meal_type] = [];
    byDate[dateKey][meal.meal_type].push(meal);
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, typeMap]) => {
      const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-PT', {
        weekday: 'long', day: 'numeric', month: 'long',
      });

      const typeGroups = Object.entries(typeMap)
        .sort(([a], [b]) => {
          const ia = MEAL_TYPE_ORDER.indexOf(a);
          const ib = MEAL_TYPE_ORDER.indexOf(b);
          if (ia === -1 && ib === -1) return a.localeCompare(b);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        })
        .map(([mealType, meals]) => ({
          mealType,
          meals: [...meals].sort((a, b) =>
            new Date(a.eaten_at).getTime() - new Date(b.eaten_at).getTime()
          ),
        }));

      return { dateKey, dateLabel, typeGroups };
    });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await api.get<Meal[]>('/api/meals?limit=50');
      setMeals(data);
    } catch (err) {
      console.error('Failed to load meals:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('history-meals-feedback')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals' }, (payload) => {
        const updated = payload.new as Meal;
        setMeals((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const grouped = groupMeals(meals);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <MealsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="px-5 pt-6 pb-8">
          <Text className="text-2xl font-bold text-gray-900 mb-6">Histórico de refeições</Text>

          {grouped.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-100 py-12 items-center">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-gray-500 text-sm">Ainda sem refeições registadas.</Text>
            </View>
          ) : (
            grouped.map(({ dateKey, dateLabel, typeGroups }) => (
              <DaySection key={dateKey} dateLabel={dateLabel} typeGroups={typeGroups} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
