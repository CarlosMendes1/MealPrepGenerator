import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Save } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import { router } from 'expo-router';

type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

const GOALS: { key: Goal; label: string }[] = [
  { key: 'lose_weight', label: 'Perder peso' },
  { key: 'gain_muscle', label: 'Ganhar músculo' },
  { key: 'maintain', label: 'Manter peso' },
  { key: 'improve_health', label: 'Melhorar saúde' },
];

interface Profile {
  full_name: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  goal: Goal | null;
  nutritionist_id: string | null;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    age: '',
    weight_kg: '',
    height_cm: '',
    body_fat_pct: '',
    goal: '' as Goal | '',
  });
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    api.get<Profile>('/api/profile').then((p) => {
      setProfile(p);
      setForm({
        full_name: p.full_name ?? '',
        age: p.age?.toString() ?? '',
        weight_kg: p.weight_kg?.toString() ?? '',
        height_cm: p.height_cm?.toString() ?? '',
        body_fat_pct: p.body_fat_pct?.toString() ?? '',
        goal: p.goal ?? '',
      });
    });
  }, []);

  function update(field: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [field]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch('/api/profile', {
        full_name: form.full_name,
        age: form.age ? parseInt(form.age) : undefined,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : undefined,
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        goal: form.goal || undefined,
      });
      Alert.alert('', 'Perfil atualizado!');
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  async function joinNutritionist() {
    if (!inviteCode.trim()) return;
    try {
      await api.post('/api/clients/join', { code: inviteCode.trim().toUpperCase() });
      Alert.alert('', 'Ligado ao nutricionista com sucesso!');
      setInviteCode('');
    } catch {
      Alert.alert('Erro', 'Código inválido ou já utilizado.');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-6 pb-8">
          <Text className="text-2xl font-bold text-gray-900 mb-6">Perfil</Text>

          {/* Body metrics */}
          <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <Text className="font-semibold text-gray-900 mb-4">Dados pessoais</Text>

            <View className="space-y-4">
              <View>
                <Text className="text-sm text-gray-500 mb-1.5">Nome</Text>
                <TextInput
                  value={form.full_name}
                  onChangeText={update('full_name')}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm"
                />
              </View>

              {[
                { label: 'Idade', field: 'age' as const, unit: 'anos' },
                { label: 'Peso', field: 'weight_kg' as const, unit: 'kg' },
                { label: 'Altura', field: 'height_cm' as const, unit: 'cm' },
                { label: 'Massa gorda', field: 'body_fat_pct' as const, unit: '%' },
              ].map((input) => (
                <View key={input.field}>
                  <Text className="text-sm text-gray-500 mb-1.5">{input.label}</Text>
                  <View className="flex-row items-center border border-gray-200 rounded-xl overflow-hidden">
                    <TextInput
                      value={form[input.field]}
                      onChangeText={update(input.field)}
                      keyboardType="numeric"
                      className="flex-1 px-4 py-3 text-sm"
                    />
                    <Text className="px-4 text-gray-400 text-sm">{input.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Goal */}
          <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <Text className="font-semibold text-gray-900 mb-4">Objetivo</Text>
            <View className="space-y-2">
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setForm((f) => ({ ...f, goal: g.key }))}
                  className={`py-3 px-4 rounded-xl border ${
                    form.goal === g.key ? 'border-brand-500 bg-brand-50' : 'border-gray-100'
                  }`}
                >
                  <Text className={`text-sm font-medium ${form.goal === g.key ? 'text-brand-700' : 'text-gray-700'}`}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className="bg-brand-600 rounded-xl py-4 items-center flex-row justify-center gap-2 mb-4"
          >
            <Save size={18} color="white" />
            <Text className="text-white font-semibold">{saving ? 'A guardar...' : 'Guardar alterações'}</Text>
          </TouchableOpacity>

          {/* Nutritionist link */}
          {!profile?.nutritionist_id && (
            <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <Text className="font-semibold text-gray-900 mb-1">Ligar ao nutricionista</Text>
              <Text className="text-xs text-gray-400 mb-4">
                Se o teu nutricionista usa o NutriDesk, introduz o código que te enviou.
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="AB3X7YQP"
                  autoCapitalize="characters"
                  maxLength={8}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center"
                />
                <TouchableOpacity
                  onPress={joinNutritionist}
                  className="bg-brand-600 px-4 rounded-xl items-center justify-center"
                >
                  <Text className="text-white text-sm font-medium">Ligar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {profile?.nutritionist_id && (
            <View className="bg-brand-50 rounded-2xl p-4 mb-4 border border-brand-100">
              <Text className="text-brand-700 font-medium text-sm">Ligado ao nutricionista</Text>
              <Text className="text-brand-600 text-xs mt-0.5">
                O teu nutricionista consegue ver as tuas refeições e dar feedback.
              </Text>
            </View>
          )}

          {/* Sign out */}
          <TouchableOpacity
            onPress={signOut}
            className="flex-row items-center justify-center gap-2 py-3"
          >
            <LogOut size={16} color="#9ca3af" />
            <Text className="text-gray-400 text-sm">Terminar sessão</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
