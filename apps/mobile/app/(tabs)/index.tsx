import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MessageSquare, Camera, TrendingUp } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { timeAgo } from '@/utils/time';

interface Meal {
  id: string;
  meal_type: string;
  eaten_at: string;
  feedback_status: string;
  nutritionist_feedback: string | null;
  ai_feedback_draft: string | null;
  ai_analysis: {
    macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    score: number;
  } | null;
}

interface Profile {
  full_name: string;
  goal: string;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast:       'Pequeno-almoço',
  morning_snack:   'Lanche da manhã',
  lunch:           'Almoço',
  afternoon_snack: 'Lanche da tarde',
  dinner:          'Jantar',
  supper:          'Ceia',
  snack:           'Snack',
};

export default function HomeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [profileData, mealsData] = await Promise.all([
        api.get<Profile>('/api/profile'),
        api.get<Meal[]>('/api/meals?limit=10'),
      ]);
      setProfile(profileData);

      const today = new Date().toDateString();
      const todayFiltered = (mealsData as Meal[]).filter(
        (m) => new Date(m.eaten_at).toDateString() === today
      );
      setTodayMeals(todayFiltered);
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Realtime: patch meal in state when nutritionist sends feedback
  useEffect(() => {
    const channel = supabase
      .channel('home-meals-feedback')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meals' },
        (payload) => {
          const updated = payload.new as Meal;
          setTodayMeals((prev) =>
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

  const totalCalories = todayMeals.reduce((acc, m) => acc + (m.ai_analysis?.macros.calories ?? 0), 0);
  const totalProtein = todayMeals.reduce((acc, m) => acc + (m.ai_analysis?.macros.protein_g ?? 0), 0);
  const pendingFeedback = todayMeals.filter((m) => m.feedback_status === 'sent').length;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Olá';

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="text-gray-400 text-sm mt-3">A carregar...</Text>
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
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <View>
              <Text className="text-2xl font-bold text-gray-900">Olá, {firstName}</Text>
              <Text className="text-gray-400 text-sm mt-0.5">
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
          </View>

          {/* Daily stats */}
          <View className="flex-row gap-3 mb-6">
            {[
              { label: 'kcal hoje', value: totalCalories, color: 'bg-orange-50 text-orange-600', border: 'border-orange-100' },
              { label: 'proteína', value: `${Math.round(totalProtein)}g`, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' },
              { label: 'refeições', value: todayMeals.length, color: 'bg-brand-50 text-brand-600', border: 'border-brand-100' },
            ].map((stat) => (
              <View key={stat.label} className={`flex-1 border rounded-xl p-3 ${stat.border}`}>
                <Text className={`text-xl font-bold ${stat.color.split(' ')[1]}`}>{stat.value}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Quick action */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/camera')}
            className="bg-brand-600 rounded-2xl p-5 flex-row items-center gap-4 mb-6"
          >
            <View className="bg-white/20 w-12 h-12 rounded-xl items-center justify-center">
              <Camera color="white" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">Registar refeição</Text>
              <Text className="text-white/70 text-sm">Fotografa o que acabaste de comer</Text>
            </View>
          </TouchableOpacity>

          {/* Today's meals */}
          <Text className="font-bold text-gray-900 text-base mb-3">Refeições de hoje</Text>

          {todayMeals.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-100 py-10 items-center">
              <Text className="text-4xl mb-3">🍽️</Text>
              <Text className="text-gray-500 text-sm">Ainda sem refeições hoje</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/camera')}
                className="mt-4 bg-brand-50 px-5 py-2.5 rounded-xl"
              >
                <Text className="text-brand-700 font-medium text-sm">Registar agora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="space-y-3">
              {todayMeals.map((meal) => (
                <View key={meal.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-semibold text-gray-900 text-sm">
                      {MEAL_LABELS[meal.meal_type] ?? meal.meal_type}
                    </Text>
                    <Text className="text-xs text-gray-400">{timeAgo(meal.eaten_at)}</Text>
                  </View>
                  {meal.ai_analysis && (
                    <View className="flex-row gap-2 mb-2">
                      {[
                        { label: 'kcal', v: meal.ai_analysis.macros.calories },
                        { label: 'prot', v: `${meal.ai_analysis.macros.protein_g}g` },
                        { label: 'score', v: `${meal.ai_analysis.score}/10` },
                      ].map((s) => (
                        <View key={s.label} className="bg-gray-50 rounded-lg px-2 py-1 items-center">
                          <Text className="text-xs font-bold text-gray-700">{s.v}</Text>
                          <Text className="text-xs text-gray-400">{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {meal.feedback_status === 'sent' && meal.nutritionist_feedback && (
                    <View className="bg-brand-50 rounded-xl px-3 py-2.5 mt-1">
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <MessageSquare size={12} color="#16a34a" />
                        <Text className="text-xs font-semibold text-brand-700">Feedback do nutricionista</Text>
                      </View>
                      <Text className="text-sm text-gray-700">{meal.nutritionist_feedback}</Text>
                    </View>
                  )}

                  {meal.feedback_status === 'draft' && (
                    <View className="bg-amber-50 rounded-xl px-3 py-2 mt-1">
                      <Text className="text-xs text-amber-600">A aguardar revisão do nutricionista...</Text>
                    </View>
                  )}

                  {meal.feedback_status === 'pending_ai' && (
                    <View className="bg-gray-50 rounded-xl px-3 py-2 mt-1">
                      <Text className="text-xs text-gray-400">A analisar com IA...</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
