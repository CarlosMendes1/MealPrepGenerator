import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Clock } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';

interface Meal {
  id: string;
  photo_url: string;
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

// Canonical order and labels for every meal type
const MEAL_TYPE_ORDER: string[] = [
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_ai: { label: 'A analisar...', bg: 'bg-gray-100', text: 'text-gray-500' },
  draft:      { label: 'Aguarda revisão', bg: 'bg-amber-100', text: 'text-amber-700' },
  sent:       { label: 'Feedback recebido', bg: 'bg-brand-100', text: 'text-brand-700' },
};

// Group meals: date → meal_type → Meal[]
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
    .sort(([a], [b]) => b.localeCompare(a)) // newest day first
    .map(([dateKey, typeMap]) => {
      const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-PT', {
        weekday: 'long', day: 'numeric', month: 'long',
      });

      // Sort type groups in canonical order; unknown types go last alphabetically
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

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await api.get<Meal[]>('/api/meals?limit=50');
      setMeals(data);
    } catch (err) {
      console.error('Failed to load meals:', err);
    }
  }

  useEffect(() => { load(); }, []);

  // Realtime: patch meal in state when nutritionist sends feedback
  useEffect(() => {
    const channel = supabase
      .channel('history-meals-feedback')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meals' },
        (payload) => {
          const updated = payload.new as Meal;
          setMeals((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const grouped = groupMeals(meals);

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
              <View key={dateKey} className="mb-6">
                {/* Day header */}
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 capitalize">
                  {dateLabel}
                </Text>

                {/* Meal type sections */}
                {typeGroups.map(({ mealType, meals: typeMeals }) => (
                  <View key={mealType} className="mb-4">
                    {/* Meal type label */}
                    <View className="flex-row items-center gap-2 mb-2 px-1">
                      <Text className="text-base">{MEAL_EMOJI[mealType] ?? '🍽️'}</Text>
                      <Text className="text-xs font-semibold text-gray-600">
                        {MEAL_LABELS[mealType] ?? mealType}
                      </Text>
                      <View className="flex-1 h-px bg-gray-200 ml-1" />
                    </View>

                    <View className="space-y-2">
                      {typeMeals.map((meal) => {
                        const status = STATUS_CONFIG[meal.feedback_status] ?? STATUS_CONFIG.pending_ai;

                        return (
                          <View key={meal.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <View className="flex-row gap-3 p-4">
                              {/* Thumbnail */}
                              <Image
                                source={{ uri: meal.photo_url }}
                                className="w-20 h-20 rounded-xl"
                                resizeMode="cover"
                              />

                              {/* Content */}
                              <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-1">
                                  <View className="flex-row items-center gap-1">
                                    <Clock size={11} color="#9ca3af" />
                                    <Text className="text-xs text-gray-400">
                                      {new Date(meal.eaten_at).toLocaleTimeString('pt-PT', {
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </Text>
                                  </View>
                                  <View className={`px-2 py-0.5 rounded-full ${status.bg}`}>
                                    <Text className={`text-xs font-medium ${status.text}`}>
                                      {status.label}
                                    </Text>
                                  </View>
                                </View>

                                {meal.ai_analysis && (
                                  <View className="flex-row gap-2 mt-1">
                                    {[
                                      { label: 'kcal', v: meal.ai_analysis.macros.calories },
                                      { label: 'prot', v: `${meal.ai_analysis.macros.protein_g}g` },
                                      { label: 'score', v: `${meal.ai_analysis.score}/10` },
                                    ].map((m) => (
                                      <View key={m.label} className="bg-gray-50 rounded-lg px-2 py-1 items-center">
                                        <Text className="text-xs font-bold text-gray-700">{m.v}</Text>
                                        <Text className="text-xs text-gray-400">{m.label}</Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Foods */}
                            {meal.ai_analysis?.foods && meal.ai_analysis.foods.length > 0 && (
                              <View className="px-4 pb-3">
                                <View className="flex-row flex-wrap gap-1.5">
                                  {meal.ai_analysis.foods.slice(0, 4).map((food, i) => (
                                    <View key={i} className="bg-brand-50 px-2 py-0.5 rounded-full">
                                      <Text className="text-xs text-brand-700">{food.name}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}

                            {/* Feedback */}
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
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
