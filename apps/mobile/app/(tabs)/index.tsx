import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Camera, MessageSquare, Sparkles, ChevronRight } from 'lucide-react-native';
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
  const totalCarbs    = todayMeals.reduce((acc, m) => acc + (m.ai_analysis?.macros.carbs_g   ?? 0), 0);
  const totalFat      = todayMeals.reduce((acc, m) => acc + (m.ai_analysis?.macros.fat_g     ?? 0), 0);
  const macroCalories = totalProtein * 4 + totalCarbs * 4 + totalFat * 9;
  const pct = (g: number, kcalPerG: number) =>
    macroCalories > 0 ? Math.round((g * kcalPerG / macroCalories) * 100) : 0;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Olá';
  const isAIMode  = !profile?.nutritionist_id;
  const hasCoach  = profile?.ai_coach_enabled;

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
        <View className="bg-brand-600 mx-4 mt-5 rounded-3xl px-5 pt-6 pb-6"
          style={{ shadowColor: '#4f46e5', shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 }}>
          <Text className="text-white text-2xl font-bold tracking-tight">Olá, {firstName} 👋</Text>
          <Text className="text-white/80 text-sm font-medium mt-1.5 capitalize">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>

        <View className="px-4 pt-5 pb-10" style={{ gap: 16 }}>

          {/* ── Stats — row 1: refeições + kcal ─────────────────────────── */}
          <View className="flex-row gap-3">
            {/* Refeições */}
            <View className="flex-1 bg-white rounded-2xl px-4 py-4 border border-slate-100"
              style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-3xl font-bold text-brand-600">{todayMeals.length}</Text>
              <Text className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wide">Refeições</Text>
            </View>
            {/* Kcal */}
            <View className="flex-1 bg-white rounded-2xl px-4 py-4 border border-slate-100"
              style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-3xl font-bold text-orange-500">{Math.round(totalCalories)}</Text>
              <Text className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wide">kcal hoje</Text>
            </View>
          </View>

          {/* ── Stats — row 2: macros ────────────────────────────────────── */}
          <View className="flex-row gap-3">
            {[
              { label: 'Proteína',  value: Math.round(totalProtein), pct: pct(totalProtein, 4), color: '#3b82f6', bg: '#eff6ff' },
              { label: 'Hidratos',  value: Math.round(totalCarbs),   pct: pct(totalCarbs, 4),   color: '#f59e0b', bg: '#fffbeb' },
              { label: 'Gordura',   value: Math.round(totalFat),     pct: pct(totalFat, 9),     color: '#ef4444', bg: '#fef2f2' },
            ].map((m) => (
              <View key={m.label} className="flex-1 bg-white rounded-2xl px-3 py-3.5 border border-slate-100 items-center"
                style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
                <View className="rounded-lg px-2 py-0.5 mb-1.5" style={{ backgroundColor: m.bg }}>
                  <Text className="text-xs font-bold" style={{ color: m.color }}>{m.pct}%</Text>
                </View>
                <Text className="text-base font-bold text-slate-800">{m.value}g</Text>
                <Text className="text-xs text-slate-400 font-medium mt-0.5">{m.label}</Text>
              </View>
            ))}
          </View>

          {/* ── AI Coach CTA ──────────────────────────────────────────────── */}
          {isAIMode && !hasCoach && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/coach')}
              className="bg-white rounded-2xl border border-brand-100 px-4 py-4 flex-row items-center gap-4"
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

          {/* ── Quick action ──────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/camera')}
            className="bg-nutrition-600 rounded-2xl px-5 py-5 flex-row items-center gap-4"
            style={{ shadowColor: '#059669', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
          >
            <View className="bg-white/20 w-12 h-12 rounded-xl items-center justify-center">
              <Camera color="white" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">Registar refeição</Text>
              <Text className="text-white/70 text-sm mt-0.5">Fotografa o que acabaste de comer</Text>
            </View>
          </TouchableOpacity>

          {/* ── Today's meals ─────────────────────────────────────────────── */}
          <View>
            <Text className="font-bold text-slate-900 text-base mb-4">Refeições de hoje</Text>

            {todayMeals.length === 0 ? (
              <View className="bg-white rounded-2xl border border-slate-100 py-12 items-center"
                style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
                <Text className="text-5xl mb-4">🍽️</Text>
                <Text className="text-slate-500 text-sm font-semibold">Ainda sem refeições hoje</Text>
                <Text className="text-slate-400 text-xs mt-1 mb-5">Regista a tua primeira refeição</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/camera')}
                  className="bg-brand-600 px-6 py-3 rounded-xl"
                  style={{ shadowColor: '#4f46e5', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
                >
                  <Text className="text-white font-bold text-sm">Registar agora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {todayMeals.map((meal) => <TodayMealCard key={meal.id} meal={meal} />)}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
