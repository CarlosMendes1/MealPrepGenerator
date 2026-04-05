import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { Camera, Sparkles, ChevronRight, Lock } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { timeAgo } from '@/utils/time';
import { PaywallModal } from '@/components/PaywallModal';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

// ── Constants ─────────────────────────────────────────────────────────────────

const FREE_MEAL_LIMIT = 3;

type GoalKey = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

const DAILY_TARGETS: Record<GoalKey, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {
  lose_weight:    { calories: 1600, protein_g: 130, carbs_g: 150, fat_g: 55 },
  gain_muscle:    { calories: 2600, protein_g: 180, carbs_g: 280, fat_g: 85 },
  maintain:       { calories: 2000, protein_g: 120, carbs_g: 220, fat_g: 70 },
  improve_health: { calories: 1900, protein_g: 110, carbs_g: 200, fat_g: 65 },
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Pequeno-almoço', morning_snack: 'Lanche manhã',
  lunch: 'Almoço', afternoon_snack: 'Lanche tarde',
  dinner: 'Jantar', supper: 'Ceia', snack: 'Snack',
};

const SCORE_GRADE: Record<number, { label: string; color: string; bg: string }> = {
  10: { label: 'A+', color: '#059669', bg: '#d1fae5' },
  9:  { label: 'A',  color: '#059669', bg: '#d1fae5' },
  8:  { label: 'B+', color: '#2563eb', bg: '#dbeafe' },
  7:  { label: 'B',  color: '#2563eb', bg: '#dbeafe' },
  6:  { label: 'C+', color: '#d97706', bg: '#fef3c7' },
  5:  { label: 'C',  color: '#d97706', bg: '#fef3c7' },
  4:  { label: 'D',  color: '#dc2626', bg: '#fee2e2' },
};
function getGrade(score: number) {
  return SCORE_GRADE[Math.round(score)] ?? { label: 'D', color: '#dc2626', bg: '#fee2e2' };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Meal {
  id: string;
  photo_url: string | null;
  meal_type: string;
  eaten_at: string;
  feedback_status: string;
  nutritionist_feedback: string | null;
  ai_feedback_draft: string | null;
  ai_analysis: {
    macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    score: number;
    summary: string;
  } | null;
}

interface Profile {
  full_name: string;
  goal: string | null;
  nutritionist_id: string | null;
  ai_coach_enabled: boolean;
}

// ── Calorie Ring ──────────────────────────────────────────────────────────────

function CalorieRing({ calories, target }: { calories: number; target: number }) {
  const SIZE = 190;
  const SW = 14;
  const R = (SIZE - SW) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = Math.min(calories / Math.max(target, 1), 1);
  const offset = CIRC * (1 - progress);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke="rgba(255,255,255,0.12)" strokeWidth={SW} fill="none" />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke="#fff"
          strokeWidth={SW}
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2},${SIZE / 2}`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.ringLabel}>Calorias</Text>
        <Text style={styles.ringCalories}>{Math.round(calories).toLocaleString('pt-PT')}</Text>
        <Text style={styles.ringTarget}>/ {target.toLocaleString('pt-PT')} kcal</Text>
      </View>
    </View>
  );
}

// ── Macro Card ────────────────────────────────────────────────────────────────

function MacroCard({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={styles.macroCard}>
      <Text style={[styles.macroLabel, { color }]}>{label}</Text>
      <Text style={styles.macroValue}>{Math.round(value)}g</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Coach Insight ─────────────────────────────────────────────────────────────

function CoachInsight({ text }: { text: string }) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIcon}>
        <Sparkles size={16} color="#4f46e5" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.insightTitle}>Insight do Coach</Text>
        <Text style={styles.insightText}>{text}</Text>
      </View>
    </View>
  );
}

// ── Weekly Trend ──────────────────────────────────────────────────────────────

function WeeklyTrend({ data }: { data: { day: string; calories: number; isToday: boolean }[] }) {
  const maxCal = Math.max(...data.map((d) => d.calories), 1);
  return (
    <View style={styles.trendRow}>
      {data.map((d, i) => {
        const h = Math.max((d.calories / maxCal) * 72, d.calories > 0 ? 8 : 3);
        return (
          <View key={i} style={styles.trendBarWrap}>
            <View style={styles.trendBarOuter}>
              <View style={[styles.trendBarFill, {
                height: h,
                backgroundColor: d.isToday ? '#4f46e5' : d.calories > 0 ? '#c7d2fe' : '#e2e8f0',
              }]} />
            </View>
            <Text style={[styles.trendDay, d.isToday && { color: '#4f46e5', fontWeight: '700' }]}>
              {d.day}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Recent meal pill ──────────────────────────────────────────────────────────

function RecentMealPill({ meal }: { meal: Meal }) {
  const grade = meal.ai_analysis ? getGrade(meal.ai_analysis.score) : null;
  return (
    <TouchableOpacity
      style={styles.recentPill}
      onPress={() => router.push('/(tabs)/meals')}
      activeOpacity={0.8}
    >
      {grade && (
        <View style={[styles.gradeBadge, { backgroundColor: grade.bg }]}>
          <Text style={[styles.gradeText, { color: grade.color }]}>{grade.label}</Text>
        </View>
      )}
      <Text style={styles.recentMealType} numberOfLines={1}>
        {MEAL_LABELS[meal.meal_type] ?? meal.meal_type}
      </Text>
      {meal.ai_analysis && (
        <Text style={styles.recentMealCal}>{Math.round(meal.ai_analysis.macros.calories)} kcal</Text>
      )}
      <Text style={styles.recentMealTime}>{timeAgo(meal.eaten_at)}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [allMeals, setAllMeals]   = useState<Meal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  async function load() {
    const [profileResult, mealsResult] = await Promise.allSettled([
      api.get<Profile>('/api/profile'),
      api.get<Meal[]>('/api/meals?limit=100'),
    ]);

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
    } else {
      showToast('Erro ao carregar perfil. Tenta novamente.', 'error');
    }

    if (mealsResult.status === 'fulfilled') {
      const mealsData = mealsResult.value;
      const today = new Date().toDateString();
      setTodayMeals(mealsData.filter((m) => new Date(m.eaten_at).toDateString() === today));
      setAllMeals(mealsData);
    } else {
      showToast('Erro ao carregar refeições. Tenta novamente.', 'error');
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Realtime feedback updates
  useEffect(() => {
    const channel = supabase
      .channel('home-meals-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals' }, (payload) => {
        const updated = payload.new as Meal;
        setTodayMeals((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setAllMeals((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  // ── Derived values (memoised) ───────────────────────────────────────────────

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Olá';
  const isAIMode  = !profile?.nutritionist_id;
  const hasCoach  = profile?.ai_coach_enabled ?? false;
  const isFreeUser = isAIMode && !hasCoach;
  const goalKey   = (profile?.goal as GoalKey | null) ?? 'maintain';
  const targets   = DAILY_TARGETS[goalKey] ?? DAILY_TARGETS.maintain;

  const { totalCalories, totalProtein, totalCarbs, totalFat } = useMemo(() => ({
    totalCalories: todayMeals.reduce((a, m) => a + (m.ai_analysis?.macros.calories  ?? 0), 0),
    totalProtein:  todayMeals.reduce((a, m) => a + (m.ai_analysis?.macros.protein_g ?? 0), 0),
    totalCarbs:    todayMeals.reduce((a, m) => a + (m.ai_analysis?.macros.carbs_g   ?? 0), 0),
    totalFat:      todayMeals.reduce((a, m) => a + (m.ai_analysis?.macros.fat_g     ?? 0), 0),
  }), [todayMeals]);

  // Coach insight: latest meal with an AI draft
  const latestInsight = useMemo(
    () => todayMeals.find((m) => m.ai_feedback_draft)?.ai_feedback_draft ?? null,
    [todayMeals]
  );

  // Weekly trend (7 days, oldest → today)
  const weekData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toDateString();
    const dayMeals = allMeals.filter((m) => new Date(m.eaten_at).toDateString() === dayStr);
    const calories  = dayMeals.reduce((a, m) => a + (m.ai_analysis?.macros.calories ?? 0), 0);
    const raw = d.toLocaleDateString('pt-PT', { weekday: 'short' });
    return { day: raw.charAt(0).toUpperCase() + raw.slice(1, 3), calories, isToday: i === 6 };
  }), [allMeals]);

  const freeMealsUsed    = Math.min(todayMeals.length, FREE_MEAL_LIMIT);
  const freeLimitReached = isFreeUser && todayMeals.length >= FREE_MEAL_LIMIT;

  // Skeleton while loading
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#3730a3' }} edges={['top']}>
        <View style={{ flex: 1, backgroundColor: '#3730a3', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 190, height: 190, borderRadius: 95, borderWidth: 14, borderColor: 'rgba(255,255,255,0.12)' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#3730a3' }} edges={['top']}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        mealsToday={todayMeals.length}
        limit={FREE_MEAL_LIMIT}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.6)" />}
      >
        {/* ── Top dark section ─────────────────────────────────────────── */}
        <View style={styles.topSection}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Olá, {firstName} 👋</Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            {isFreeUser && (
              <TouchableOpacity onPress={() => setPaywallVisible(true)} style={[
                styles.counterPill,
                freeLimitReached && { backgroundColor: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.4)' },
              ]}>
                {freeLimitReached && <Lock size={10} color="#fca5a5" />}
                <Text style={[styles.counterText, freeLimitReached && { color: '#fca5a5' }]}>
                  {freeMealsUsed}/{FREE_MEAL_LIMIT}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Calorie ring */}
          <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
            <CalorieRing calories={totalCalories} target={targets.calories} />
          </View>
        </View>

        {/* ── Content section ───────────────────────────────────────────── */}
        <View style={styles.contentSection}>

          {/* Macro cards */}
          <View style={styles.macroRow}>
            <MacroCard label="PROTEÍNA" value={totalProtein} target={targets.protein_g} color="#22c55e" />
            <MacroCard label="HIDRATOS" value={totalCarbs}   target={targets.carbs_g}   color="#6366f1" />
            <MacroCard label="GORDURA"  value={totalFat}     target={targets.fat_g}     color="#f59e0b" />
          </View>

          {/* Coach's insight */}
          {latestInsight ? (
            <CoachInsight text={latestInsight} />
          ) : (
            <TouchableOpacity
              style={[styles.insightCard, { opacity: 0.75 }]}
              onPress={() => router.push('/(tabs)/camera')}
              activeOpacity={0.8}
            >
              <View style={styles.insightIcon}>
                <Sparkles size={16} color="#4f46e5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>Insight do Coach</Text>
                <Text style={styles.insightText}>
                  Regista a tua primeira refeição do dia para receberes o insight personalizado do Coach.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Weekly trend */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tendência semanal</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>Últimos 7 dias</Text>
              </View>
            </View>
            <WeeklyTrend data={weekData} />
            {/* Avg calories */}
            {weekData.some((d) => d.calories > 0) && (
              <Text style={styles.trendAvg}>
                Média:{' '}
                {Math.round(weekData.reduce((a, d) => a + d.calories, 0) / weekData.filter((d) => d.calories > 0).length)} kcal/dia
              </Text>
            )}
          </View>

          {/* Free counter bar */}
          {isFreeUser && (
            <TouchableOpacity
              onPress={() => setPaywallVisible(true)}
              style={[styles.freeBar, freeLimitReached && { borderColor: '#fca5a5', backgroundColor: '#fff5f5' }]}
              activeOpacity={0.8}
            >
              <View style={[styles.freeDot, { backgroundColor: freeLimitReached ? '#ef4444' : '#4f46e5' }]}>
                {freeLimitReached ? <Lock size={12} color="#fff" /> : <Camera size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.freeText, freeLimitReached && { color: '#dc2626' }]}>
                  {freeLimitReached ? 'Limite diário atingido' : `${freeMealsUsed} de ${FREE_MEAL_LIMIT} refeições gratuitas`}
                </Text>
                <View style={styles.freeTrack}>
                  <View style={[styles.freeFill, {
                    width: `${Math.min((freeMealsUsed / FREE_MEAL_LIMIT) * 100, 100)}%` as any,
                    backgroundColor: freeLimitReached ? '#ef4444' : '#4f46e5',
                  }]} />
                </View>
              </View>
              <ChevronRight size={14} color={freeLimitReached ? '#ef4444' : '#94a3b8'} />
            </TouchableOpacity>
          )}

          {/* AI Coach CTA */}
          {isAIMode && !hasCoach && (
            <TouchableOpacity
              style={styles.coachCta}
              onPress={() => router.push('/(tabs)/coach')}
              activeOpacity={0.85}
            >
              <View style={styles.coachCtaIcon}>
                <Sparkles size={20} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coachCtaTitle}>Ativa o NutriCoach AI</Text>
                <Text style={styles.coachCtaSub}>7 dias grátis · €9/mês</Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}

          {/* Quick register CTA */}
          <TouchableOpacity
            style={styles.registerCta}
            onPress={() => router.push('/(tabs)/camera')}
            activeOpacity={0.85}
          >
            <View style={styles.registerCtaIcon}>
              <Camera size={22} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.registerCtaTitle}>Registar refeição</Text>
              <Text style={styles.registerCtaSub}>Foto, ingredientes ou texto</Text>
            </View>
          </TouchableOpacity>

          {/* Recent meals */}
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Refeições recentes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/meals')}>
                <Text style={styles.viewAll}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            {todayMeals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🍽️</Text>
                <Text style={styles.emptyTitle}>Sem refeições hoje</Text>
                <Text style={styles.emptySub}>Regista a tua primeira refeição do dia</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {todayMeals.slice(0, 5).map((meal) => <RecentMealPill key={meal.id} meal={meal} />)}
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Top
  topSection: {
    backgroundColor: '#3730a3',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  dateText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3, textTransform: 'capitalize' },
  counterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  counterText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  // Ring
  ringLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  ringCalories: { fontSize: 40, fontWeight: '800', color: '#fff', lineHeight: 46, marginTop: 2 },
  ringTarget:   { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Content section
  contentSection: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },

  // Macros
  macroRow:  { flexDirection: 'row', gap: 10 },
  macroCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18,
    padding: 14, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  macroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  macroValue: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  macroTrack: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, marginTop: 10 },
  macroFill:  { height: 4, borderRadius: 2 },

  // Insight
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#eef2ff', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  insightIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4f46e5', shadowOpacity: 0.1, shadowRadius: 4, elevation: 1,
  },
  insightTitle: { fontSize: 13, fontWeight: '700', color: '#3730a3', marginBottom: 4 },
  insightText:  { fontSize: 13, color: '#4338ca', lineHeight: 20 },

  // Weekly trend
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  sectionBadge:  { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#4f46e5' },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#4f46e5' },

  trendRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  trendBarWrap: { flex: 1, alignItems: 'center', gap: 6 },
  trendBarOuter: { height: 76, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  trendBarFill:  { width: '65%', borderRadius: 4 },
  trendDay: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  trendAvg: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 12 },

  // Free counter
  freeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  freeDot: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  freeText:  { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  freeTrack: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
  freeFill:  { height: 4, borderRadius: 2 },

  // Coach CTA
  coachCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#e0e7ff',
    shadowColor: '#4f46e5', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  coachCtaIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center',
  },
  coachCtaTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  coachCtaSub:   { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Register CTA
  registerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#059669', borderRadius: 18, padding: 16,
    shadowColor: '#059669', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  registerCtaIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  registerCtaTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  registerCtaSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Recent meals
  recentPill: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  gradeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gradeText:  { fontSize: 12, fontWeight: '800' },
  recentMealType: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  recentMealCal:  { fontSize: 12, fontWeight: '700', color: '#f97316' },
  recentMealTime: { fontSize: 11, color: '#94a3b8' },

  // Empty state
  emptyState: {
    backgroundColor: '#fff', borderRadius: 18, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 4 },
  emptySub:   { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
});
