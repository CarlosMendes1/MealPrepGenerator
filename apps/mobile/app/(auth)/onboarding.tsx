import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '@/services/api';

type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

const GOALS: { key: Goal; label: string; emoji: string }[] = [
  { key: 'lose_weight', label: 'Perder peso', emoji: '🔥' },
  { key: 'gain_muscle', label: 'Ganhar músculo', emoji: '💪' },
  { key: 'maintain', label: 'Manter peso', emoji: '⚖️' },
  { key: 'improve_health', label: 'Melhorar saúde', emoji: '🌱' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    age: '',
    weight_kg: '',
    height_cm: '',
    body_fat_pct: '',
    goal: '' as Goal | '',
  });
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [field]: val }));
  }

  async function finish() {
    setLoading(true);
    try {
      await api.patch('/api/profile', {
        age: form.age ? parseInt(form.age) : undefined,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : undefined,
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        goal: form.goal || undefined,
      });

      router.replace('/(tabs)/');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível guardar o perfil. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    // Step 0: Body metrics
    <View key={0} className="flex-1">
      <Text className="text-2xl font-bold text-gray-900 mb-2">O teu corpo</Text>
      <Text className="text-gray-400 mb-8">Estes dados ajudam a personalizar o feedback</Text>

      <View className="space-y-4">
        {[
          { label: 'Idade', field: 'age' as const, placeholder: '28', unit: 'anos' },
          { label: 'Peso', field: 'weight_kg' as const, placeholder: '70', unit: 'kg' },
          { label: 'Altura', field: 'height_cm' as const, placeholder: '170', unit: 'cm' },
          { label: 'Massa gorda (opcional)', field: 'body_fat_pct' as const, placeholder: '18', unit: '%' },
        ].map((input) => (
          <View key={input.field}>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">{input.label}</Text>
            <View className="flex-row items-center border border-gray-200 rounded-xl overflow-hidden">
              <TextInput
                value={form[input.field]}
                onChangeText={update(input.field)}
                keyboardType="numeric"
                placeholder={input.placeholder}
                className="flex-1 px-4 py-3.5 text-base"
              />
              <Text className="px-4 text-gray-400 text-sm">{input.unit}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => setStep(1)}
        className="bg-brand-600 rounded-xl py-4 mt-8 items-center"
      >
        <Text className="text-white font-semibold text-base">Continuar</Text>
      </TouchableOpacity>
    </View>,

    // Step 1: Goal
    <View key={1} className="flex-1">
      <Text className="text-2xl font-bold text-gray-900 mb-2">O teu objetivo</Text>
      <Text className="text-gray-400 mb-8">A IA vai adaptar o feedback ao teu objetivo</Text>

      <View className="space-y-3">
        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.key}
            onPress={() => setForm((f) => ({ ...f, goal: g.key }))}
            className={`flex-row items-center gap-4 p-4 rounded-xl border-2 ${
              form.goal === g.key ? 'border-brand-500 bg-brand-50' : 'border-gray-100 bg-white'
            }`}
          >
            <Text className="text-2xl">{g.emoji}</Text>
            <Text className={`text-base font-medium ${form.goal === g.key ? 'text-brand-700' : 'text-gray-800'}`}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={finish}
        disabled={!form.goal || loading}
        className={`rounded-xl py-4 mt-8 items-center ${form.goal ? 'bg-brand-600' : 'bg-gray-200'}`}
      >
        <Text className={`font-semibold text-base ${form.goal ? 'text-white' : 'text-gray-400'}`}>
          {loading ? 'A guardar...' : 'Começar'}
        </Text>
      </TouchableOpacity>
    </View>,

    // Step 1 end: Goal → finish
    // (nutritionist code is collected during registration)
  ];

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* Progress dots */}
        <View className="flex-row gap-2 mb-10">
          {steps.map((_, i) => (
            <View
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-gray-100'}`}
            />
          ))}
        </View>

        {steps[step]}
      </View>
    </ScrollView>
  );
}
