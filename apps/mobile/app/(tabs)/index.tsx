import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Camera, MessageSquare, Sparkles, UserCheck, ChevronRight } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { timeAgo } from '@/utils/time';
import { HomeSkeleton } from '@/components/Skeleton';

interface Meal {
  id: string;
  meal_type: string;
  eaten_at: string;
  feedback_status: string;
  nutritionist_feedback: string | null;
  ai_analysis: {
    macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    score: number;
  } | null;
}

interface Profile {
  full_name: string;
  goal: string;
  nutritionist_id: string | null;
  ai_coach_enabled: boolean;
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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-100"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
      <Text style={{ color }} className="text-xl font-bold">{value}</Text>
      <Text className="text-xs text-slate-400 mt-0.5 font-medium">{label}</Text>
    </View>
  );
}

// ── Today meal card ───────────────────────────────────────────────────────────

function TodayMealCard({ meal }: { meal: Meal }) {
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-bold text-slate-800 text-sm">
          {MEAL_LABELS[meal.meal_type] ?? meal.meal_type}
        </Text>
        <Text className="text-xs text-slate-400">{timeAgo(meal.eaten_at)}</Text>
      </View>

      {meal.ai_analysis && (
        <View className="flex-row gap-2 mb-2">
          {[
            { label: 'kcal',  value: meal.ai_analysis.macros.calories,              color: '#f97316' },
            { label: 'prot',  value: `${meal.ai_analysis.macros.protein_g}g`,       color: '#3b82f6' },
            { label: 'score', value: `${meal.ai_analysis.score}/10`,                color: '#4f46e5' },
          ].map((s) => (
            <View key={s.label} className="bg-slate-50 rounded-lg px-2.5 py-1.5 items-center">
              <Text className="text-xs font-bold" style={{ color: s.color }}>{s.value}</Text>
              <Text className="text-xs text-slate-400">{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {meal.feedback_status === 'sent' && meal.nutritionist_feedback && (
        <View className="bg-nutrition-50 rounded-xl px-3 py-2.5 mt-1">
          <View className="flex-row items-center gap-1.5 mb-1">
            <MessageSquare size={12} color="#059669" />
            <Text className="text-xs font-semibold text-nutrition-700">Feedback do nutricionista</Text>
          </View>
          <Text className="text-sm text-slate-700">{meal.nutritionist_feedback}</Text>
        </View>
      )}

      {meal.feedback_status === 'pending_ai' && (
        <View className="bg-slate-50 rounded-xl px-3 py-2 mt-1 flex-row items-center gap-2">
          <Sparkles size={11} color="#4f46e5" />
          <Text className="text-xs text-slate-400">Coach AI a analisar...</Text>
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [profileData, mealsData] = await Promise.all([
        api.get<Profile>('/api/profile'),
        api.get<Meal[]>('/api/meals?limit=20'),
      ]);
      setProfile(profileData);
      const today = new Date().toDateString();
      setTodayMeals((mealsData as Meal[]).filter((m) => new Date(m.eaten_at).toDateString() === today));
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('home-meals-feedback')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals' }, (payload) => {
        const updated = payload.new as Meal;
        setTodayMeals((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  const totalCalories = todayMeals.reduce((acc, m) => acc + (m.ai_analysis?.macros.calories ?? 0), 0);
  const totalProtein  = todayMeals.reduce((acc, m) => acc + (m.ai_analysis?.macros.protein_g ?? 0), 0);
  const firstName     = profile?.full_name?.split(' ')[0] ?? 'Olá';
  const isAIMode      = !profile?.nutritionist_id;
  const hasCoach      = profile?.ai_coach_enabled;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
      >
        {/* ── Hero header ───────────────────────────────────────────────── */}
        <View className="bg-brand-600 mx-4 mt-4 rounded-3xl px-5 pt-6 pb-5 overflow-hidden"
          style={{ shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}>
          {/* decorative circle */}
          <View className="absolute bg-white/10 rounded-full"
            style={{ width: 160, height: 160, top: -40, right: -40 }} />

          {/* greeting */}
          <Text className="text-white text-2xl font-bold tracking-tight">Olá, {firstName} 👋</Text>
          <Text className="text-brand-200 text-sm mt-0.5">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          {/* mode badge */}
          <View className="flex-row items-center gap-2 mt-4 bg-white/15 rounded-xl px-3 py-2 self-start">
            {isAIMode
              ? <Sparkles size={13} color="white" />
              : <UserCheck size={13} color="white" />
            }
            <Text className="text-white text-xs font-semibold">
              {isAIMode ? 'NutriCoach AI' : 'Acompanhado por nutricionista'}
            </Text>
          </View>
        </View>

        <View className="px-4 pt-4 pb-8 space-y-4">

          {/* ── Stats ─────────────────────────────────────────────────── */}
          <View className="flex-row gap-3">
            <StatCard label="kcal hoje"  value={totalCalories}                  color="#f97316" />
            <StatCard label="proteína"   value={`${Math.round(totalProtein)}g`} color="#3b82f6" />
            <StatCard label="refeições"  value={todayMeals.length}              color="#4f46e5" />
          </View>

          {/* ── AI Coach CTA (only when in AI mode and no subscription) ── */}
          {isAIMode && !hasCoach && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/coach')}
              className="bg-white rounded-2xl border border-brand-100 p-4 flex-row items-center gap-4"
              style={{ shadowColor: '#4f46e5', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}
            >
              <View className="bg-brand-600 w-12 h-12 rounded-2xl items-center justify-center">
                <Sparkles size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">Ativa o NutriCoach AI</Text>
                <Text className="text-slate-400 text-xs mt-0.5">7 dias grátis · €9/mês depois</Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}

          {/* ── Quick action ───────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/camera')}
            className="bg-nutrition-600 rounded-2xl p-5 flex-row items-center gap-4"
            style={{ shadowColor: '#059669', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
          >
            <View className="bg-white/20 w-12 h-12 rounded-xl items-center justify-center">
              <Camera color="white" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">Registar refeição</Text>
              <Text className="text-white/70 text-sm">Fotografa o que acabaste de comer</Text>
            </View>
          </TouchableOpacity>

          {/* ── Today's meals ──────────────────────────────────────────── */}
          <View>
            <Text className="font-bold text-slate-900 text-base mb-3">Refeições de hoje</Text>

            {todayMeals.length === 0 ? (
              <View className="bg-white rounded-2xl border border-slate-100 py-10 items-center"
                style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
                <Text className="text-4xl mb-3">🍽️</Text>
                <Text className="text-slate-500 text-sm font-medium">Ainda sem refeições hoje</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/camera')}
                  className="mt-4 bg-brand-50 px-5 py-2.5 rounded-xl"
                >
                  <Text className="text-brand-700 font-semibold text-sm">Registar agora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="space-y-3">
                {todayMeals.map((meal) => <TodayMealCard key={meal.id} meal={meal} />)}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
