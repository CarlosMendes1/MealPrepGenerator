import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Clock } from 'lucide-react-native';
import { api } from '@/services/api';

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

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Pequeno-almoço',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Snack',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_ai: { label: 'A analisar...', bg: 'bg-gray-100', text: 'text-gray-500' },
  draft: { label: 'Aguarda revisão', bg: 'bg-amber-100', text: 'text-amber-700' },
  sent: { label: 'Feedback recebido', bg: 'bg-brand-100', text: 'text-brand-700' },
};

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await api.get<Meal[]>('/api/meals?limit=30');
      setMeals(data);
    } catch (err) {
      console.error('Failed to load meals:', err);
    }
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  // Group by date
  const grouped = meals.reduce((acc, meal) => {
    const date = new Date(meal.eaten_at).toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(meal);
    return acc;
  }, {} as Record<string, Meal[]>);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="px-5 pt-6 pb-8">
          <Text className="text-2xl font-bold text-gray-900 mb-6">Histórico de refeições</Text>

          {Object.keys(grouped).length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-100 py-12 items-center">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-gray-500 text-sm">Ainda sem refeições registadas.</Text>
            </View>
          ) : (
            Object.entries(grouped).map(([date, dateMeals]) => (
              <View key={date} className="mb-6">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 capitalize">
                  {date}
                </Text>

                <View className="space-y-3">
                  {dateMeals.map((meal) => {
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
                              <Text className="font-semibold text-gray-900 text-sm">
                                {MEAL_LABELS[meal.meal_type] ?? meal.meal_type}
                              </Text>
                              <View className={`px-2 py-0.5 rounded-full ${status.bg}`}>
                                <Text className={`text-xs font-medium ${status.text}`}>{status.label}</Text>
                              </View>
                            </View>

                            <View className="flex-row items-center gap-1 mb-2">
                              <Clock size={11} color="#9ca3af" />
                              <Text className="text-xs text-gray-400">
                                {new Date(meal.eaten_at).toLocaleTimeString('pt-PT', {
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </Text>
                            </View>

                            {meal.ai_analysis && (
                              <View className="flex-row gap-2">
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
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
