import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Sparkles, Zap, MessageSquare, TrendingUp, Clock, Calculator } from 'lucide-react-native';
import { api } from '@/services/api';
import Button from '@/components/ui/Button';

const ONBOARDING_KEY = 'onboarding_done';

type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

const GOALS: { key: Goal; label: string; emoji: string; desc: string }[] = [
  { key: 'lose_weight',    label: 'Perder peso',      emoji: '🔥', desc: 'Défice calórico inteligente' },
  { key: 'gain_muscle',   label: 'Ganhar músculo',    emoji: '💪', desc: 'Proteína e treino otimizados' },
  { key: 'maintain',      label: 'Manter peso',       emoji: '⚖️', desc: 'Equilíbrio e consistência' },
  { key: 'improve_health',label: 'Melhorar saúde',    emoji: '🌱', desc: 'Nutrição de qualidade' },
];

const COACH_FEATURES = [
  { icon: MessageSquare, text: 'Chat ilimitado com o teu coach AI' },
  { icon: TrendingUp,    text: 'Análise automática de cada refeição' },
  { icon: Zap,           text: 'Feedback personalizado ao teu objetivo' },
  { icon: Clock,         text: 'Disponível 24/7, sem esperas' },
];

const GOAL_OFFSETS: Record<Goal, number> = {
  lose_weight:    -400,
  gain_muscle:    +300,
  maintain:       0,
  improve_health: -200,
};

// Mifflin-St Jeor gender-neutral (average of male +5 / female -161 ≈ -78)
// with light activity multiplier × 1.4, rounded to nearest 50 kcal
function suggestCalories(weight_kg: number, height_cm: number, age: number, goal: Goal): number {
  const bmr  = 10 * weight_kg + 6.25 * height_cm - 5 * age - 78;
  const tdee = Math.round((bmr * 1.4) / 50) * 50;
  return Math.max(1200, tdee + GOAL_OFFSETS[goal]);
}

export default function OnboardingScreen() {
  const [step, setStep]         = useState(0);
  const [hasNutritionist, setHasNutritionist] = useState<boolean | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [suggestionKcal, setSuggestionKcal] = useState<number | null>(null);
  const [form, setForm] = useState({
    age: '', weight_kg: '', height_cm: '', body_fat_pct: '',
    goal: '' as Goal | '',
    calorie_target: '',
  });

  useEffect(() => {
    api.get<{ nutritionist_id: string | null }>('/api/profile')
      .then((p) => setHasNutritionist(!!p.nutritionist_id))
      .catch(() => setHasNutritionist(false))
      .finally(() => setLoading(false));
  }, []);

  function update(field: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [field]: val }));
  }

  function selectGoal(g: Goal) {
    const w = parseFloat(form.weight_kg);
    const h = parseFloat(form.height_cm);
    const a = parseInt(form.age);
    let suggestion: number | null = null;
    if (w > 0 && h > 0 && a > 0) {
      suggestion = suggestCalories(w, h, a, g);
    }
    setSuggestionKcal(suggestion);
    setForm((f) => ({
      ...f,
      goal: g,
      calorie_target: suggestion ? String(suggestion) : f.calorie_target,
    }));
  }

  async function finish() {
    setSaving(true);
    try {
      await api.patch('/api/profile', {
        age:            form.age        ? parseInt(form.age)           : undefined,
        weight_kg:      form.weight_kg  ? parseFloat(form.weight_kg)   : undefined,
        height_cm:      form.height_cm  ? parseFloat(form.height_cm)   : undefined,
        body_fat_pct:   form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        goal:           form.goal || undefined,
        calorie_target: form.calorie_target ? parseInt(form.calorie_target) : undefined,
      });
    } catch { /* non-fatal — proceed anyway */ }

    // Mark onboarding as done regardless of API outcome so the layout
    // never redirects the user back here again.
    await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});

    setSaving(false);

    if (!hasNutritionist) {
      setStep(2);
    } else {
      router.replace('/(tabs)/');
    }
  }

  const totalSteps = hasNutritionist ? 2 : 3;

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  const steps = [
    // ── Step 0: Body metrics ──────────────────────────────────────────────
    <View key={0} className="flex-1">
      <Text className="text-2xl font-bold text-slate-900 mb-1">O teu corpo</Text>
      <Text className="text-slate-400 text-sm mb-8">Personaliza as análises e o feedback do coach</Text>

      <View className="space-y-4">
        {[
          { label: 'Idade',   field: 'age' as const,       placeholder: '28',  unit: 'anos', optional: false },
          { label: 'Peso',    field: 'weight_kg' as const, placeholder: '70',  unit: 'kg',   optional: false },
          { label: 'Altura',  field: 'height_cm' as const, placeholder: '170', unit: 'cm',   optional: false },
          { label: 'Massa gorda', field: 'body_fat_pct' as const, placeholder: '18', unit: '%', optional: true },
        ].map((input) => (
          <View key={input.field}>
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{input.label}</Text>
              {input.optional && (
                <View className="bg-slate-100 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-slate-400">opcional</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
              <TextInput
                value={form[input.field]}
                onChangeText={update(input.field)}
                keyboardType="numeric"
                placeholder={input.placeholder}
                placeholderTextColor="#94a3b8"
                className="flex-1 px-4 py-3.5 text-base text-slate-900"
              />
              <Text className="px-4 text-slate-400 text-sm font-medium">{input.unit}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Body fat hint */}
      <Text className="text-xs text-slate-400 mt-3 leading-4">
        💡 Não sabes a tua massa gorda? Não há problema — deixa em branco. Só o peso e a altura são suficientes para boas estimativas.
      </Text>

      <Button label="Continuar" onPress={() => setStep(1)} style={{ marginTop: 24 }} />

      <TouchableOpacity
        onPress={async () => {
          await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
          setStep(1);
        }}
        className="mt-3 items-center py-2"
      >
        <Text className="text-slate-400 text-sm">Preencher mais tarde</Text>
      </TouchableOpacity>
    </View>,

    // ── Step 1: Goal + Calorie target ─────────────────────────────────────
    <View key={1} className="flex-1">
      <Text className="text-2xl font-bold text-slate-900 mb-1">O teu objetivo</Text>
      <Text className="text-slate-400 text-sm mb-6">O coach adapta-se ao que queres atingir</Text>

      <View className="space-y-3 mb-6">
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.key}
            onPress={() => selectGoal(g.key)}
            className={`flex-row items-center gap-4 p-4 rounded-xl border-2 bg-white ${
              form.goal === g.key ? 'border-brand-500' : 'border-slate-100'
            }`}
          >
            <Text className="text-2xl">{g.emoji}</Text>
            <View className="flex-1">
              <Text className={`text-sm font-bold ${form.goal === g.key ? 'text-brand-700' : 'text-slate-800'}`}>
                {g.label}
              </Text>
              <Text className="text-xs text-slate-400 mt-0.5">{g.desc}</Text>
            </View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
              form.goal === g.key ? 'border-brand-500 bg-brand-500' : 'border-slate-300'
            }`}>
              {form.goal === g.key && <View className="w-2 h-2 rounded-full bg-white" />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calorie target — appears after goal selection */}
      {form.goal ? (
        <View className="bg-white border border-slate-100 rounded-2xl p-4 mb-6"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
          <View className="flex-row items-center gap-2 mb-1">
            <Calculator size={14} color="#4f46e5" />
            <Text className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Meta calórica diária</Text>
          </View>
          {suggestionKcal ? (
            <Text className="text-xs text-slate-400 mb-3 leading-4">
              Sugestão calculada com base nos teus dados: <Text className="font-semibold text-slate-600">{suggestionKcal} kcal</Text>.
              Podes ajustar abaixo.
            </Text>
          ) : (
            <Text className="text-xs text-slate-400 mb-3 leading-4">
              Define a tua meta calórica diária. Preenche os dados corporais no passo anterior para receberes uma sugestão automática.
            </Text>
          )}
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <TextInput
              value={form.calorie_target}
              onChangeText={update('calorie_target')}
              keyboardType="numeric"
              placeholder={suggestionKcal ? String(suggestionKcal) : '1800'}
              placeholderTextColor="#94a3b8"
              className="flex-1 px-4 py-3 text-base text-slate-900"
            />
            <Text className="px-4 text-slate-400 text-sm font-medium">kcal</Text>
          </View>
        </View>
      ) : null}

      <Button
        label="Continuar"
        onPress={finish}
        loading={saving}
        disabled={!form.goal}
      />
    </View>,

    // ── Step 2: Coach upsell (only for non-nutritionist users) ────────────
    <View key={2} className="flex-1">
      <View className="items-center mb-6">
        <View className="bg-brand-600 w-20 h-20 rounded-3xl items-center justify-center mb-4"
          style={{ shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}>
          <Sparkles size={36} color="white" />
        </View>
        <Text className="text-2xl font-bold text-slate-900 text-center">Ativa o NutriCoach AI</Text>
        <Text className="text-slate-400 text-sm text-center mt-2 leading-5">
          O teu coach de nutrição inteligente, sempre disponível para te ajudar a atingir os teus objetivos.
        </Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-5 mb-5 space-y-4">
        {COACH_FEATURES.map(({ icon: Icon, text }) => (
          <View key={text} className="flex-row items-center gap-3">
            <View className="bg-brand-50 w-9 h-9 rounded-xl items-center justify-center">
              <Icon size={16} color="#4f46e5" />
            </View>
            <Text className="flex-1 text-sm text-slate-700 font-medium">{text}</Text>
          </View>
        ))}
      </View>

      <View className="bg-brand-50 rounded-xl px-4 py-3 mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-brand-600 font-semibold uppercase tracking-wide">Trial gratuito</Text>
          <Text className="text-brand-900 font-bold text-base">7 dias grátis</Text>
        </View>
        <View>
          <Text className="text-slate-400 text-xs text-right">Depois</Text>
          <Text className="text-slate-700 font-bold text-base">€9/mês</Text>
        </View>
      </View>

      <Button
        label="Experimentar grátis"
        onPress={() => router.replace('/(tabs)/coach')}
        style={{ marginBottom: 12 }}
      />
      <Button
        label="Ativar mais tarde"
        variant="ghost"
        onPress={async () => {
          await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
          router.replace('/(tabs)/');
        }}
      />
    </View>,
  ];

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
      <View className="flex-1 px-6 pt-14 pb-8">

        {/* Progress bar + step counter */}
        <View className="mb-10">
          <View className="flex-row gap-2 mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-slate-200'}`}
              />
            ))}
          </View>
          <Text className="text-xs text-slate-400 text-right font-medium">
            Passo {step + 1} de {totalSteps}
          </Text>
        </View>

        {steps[step]}
      </View>
    </ScrollView>
  );
}
