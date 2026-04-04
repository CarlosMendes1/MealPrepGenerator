import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Sparkles, Zap, MessageSquare, TrendingUp, Clock } from 'lucide-react-native';
import { api } from '@/services/api';

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

export default function OnboardingScreen() {
  const [step, setStep]         = useState(0);
  const [hasNutritionist, setHasNutritionist] = useState<boolean | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    age: '', weight_kg: '', height_cm: '', body_fat_pct: '',
    goal: '' as Goal | '',
  });

  // Check if user already linked to nutritionist
  useEffect(() => {
    api.get<{ nutritionist_id: string | null }>('/api/profile')
      .then((p) => setHasNutritionist(!!p.nutritionist_id))
      .catch(() => setHasNutritionist(false))
      .finally(() => setLoading(false));
  }, []);

  function update(field: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [field]: val }));
  }

  async function finish() {
    setSaving(true);
    try {
      await api.patch('/api/profile', {
        age:          form.age        ? parseInt(form.age)         : undefined,
        weight_kg:    form.weight_kg  ? parseFloat(form.weight_kg) : undefined,
        height_cm:    form.height_cm  ? parseFloat(form.height_cm) : undefined,
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        goal:         form.goal || undefined,
      });
      // Go to coach upsell step if no nutritionist, else go home
      if (!hasNutritionist) {
        setStep(2);
      } else {
        router.replace('/(tabs)/');
      }
    } catch {
      // non-fatal, proceed anyway
      router.replace('/(tabs)/');
    } finally {
      setSaving(false);
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
          { label: 'Idade',        field: 'age' as const,         placeholder: '28',  unit: 'anos' },
          { label: 'Peso',         field: 'weight_kg' as const,   placeholder: '70',  unit: 'kg' },
          { label: 'Altura',       field: 'height_cm' as const,   placeholder: '170', unit: 'cm' },
          { label: 'Massa gorda',  field: 'body_fat_pct' as const,placeholder: '18',  unit: '%' },
        ].map((input) => (
          <View key={input.field}>
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{input.label}</Text>
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

      <TouchableOpacity
        onPress={() => setStep(1)}
        className="bg-brand-600 rounded-xl py-4 mt-8 items-center"
        style={{ shadowColor: '#4f46e5', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
      >
        <Text className="text-white font-bold text-base">Continuar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setStep(1)} className="mt-3 items-center py-2">
        <Text className="text-slate-400 text-sm">Preencher mais tarde</Text>
      </TouchableOpacity>
    </View>,

    // ── Step 1: Goal ──────────────────────────────────────────────────────
    <View key={1} className="flex-1">
      <Text className="text-2xl font-bold text-slate-900 mb-1">O teu objetivo</Text>
      <Text className="text-slate-400 text-sm mb-8">O coach adapta-se ao que queres atingir</Text>

      <View className="space-y-3">
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.key}
            onPress={() => setForm((f) => ({ ...f, goal: g.key }))}
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

      <TouchableOpacity
        onPress={finish}
        disabled={!form.goal || saving}
        className={`rounded-xl py-4 mt-8 items-center ${form.goal ? 'bg-brand-600' : 'bg-slate-200'}`}
        style={form.goal ? { shadowColor: '#4f46e5', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 } : {}}
      >
        <Text className={`font-bold text-base ${form.goal ? 'text-white' : 'text-slate-400'}`}>
          {saving ? 'A guardar...' : 'Continuar'}
        </Text>
      </TouchableOpacity>
    </View>,

    // ── Step 2: Coach upsell (only for non-nutritionist users) ────────────
    <View key={2} className="flex-1">
      {/* Icon */}
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

      {/* Features */}
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

      {/* Price */}
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

      <TouchableOpacity
        onPress={() => router.replace('/(tabs)/coach')}
        className="bg-brand-600 rounded-xl py-4 items-center mb-3"
        style={{ shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
      >
        <Text className="text-white font-bold text-base">Experimentar grátis</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/(tabs)/')} className="items-center py-3">
        <Text className="text-slate-400 text-sm">Ativar mais tarde</Text>
      </TouchableOpacity>
    </View>,
  ];

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
      <View className="flex-1 px-6 pt-14 pb-8">

        {/* Progress bar */}
        <View className="flex-row gap-2 mb-10">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-slate-200'}`}
            />
          ))}
        </View>

        {steps[step]}
      </View>
    </ScrollView>
  );
}
