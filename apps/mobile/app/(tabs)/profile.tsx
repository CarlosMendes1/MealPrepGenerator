import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Save, Sparkles, UserCheck, ChevronRight, Link2Off } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import { router } from 'expo-router';

type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_health';

const GOALS: { key: Goal; label: string }[] = [
  { key: 'lose_weight',    label: 'Perder peso' },
  { key: 'gain_muscle',   label: 'Ganhar músculo' },
  { key: 'maintain',      label: 'Manter peso' },
  { key: 'improve_health',label: 'Melhorar saúde' },
];

interface Profile {
  full_name: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  goal: Goal | null;
  allergies: string | null;
  intolerances: string | null;
  dietary_preferences: string | null;
  lifestyle_notes: string | null;
  nutritionist_id: string | null;
  ai_coach_enabled: boolean;
}

export default function ProfileScreen() {
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [saving, setSaving]     = useState(false);
  const [joining, setJoining]   = useState(false);
  const [leaving, setLeaving]   = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [form, setForm] = useState({
    full_name: '', age: '', weight_kg: '', height_cm: '', body_fat_pct: '',
    goal: '' as Goal | '',
    allergies: '', intolerances: '', dietary_preferences: '', lifestyle_notes: '',
  });

  useEffect(() => {
    api.get<Profile>('/api/profile').then((p) => {
      setProfile(p);
      setForm({
        full_name:           p.full_name ?? '',
        age:                 p.age?.toString() ?? '',
        weight_kg:           p.weight_kg?.toString() ?? '',
        height_cm:           p.height_cm?.toString() ?? '',
        body_fat_pct:        p.body_fat_pct?.toString() ?? '',
        goal:                p.goal ?? '',
        allergies:           p.allergies ?? '',
        intolerances:        p.intolerances ?? '',
        dietary_preferences: p.dietary_preferences ?? '',
        lifestyle_notes:     p.lifestyle_notes ?? '',
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
        full_name:           form.full_name,
        age:                 form.age ? parseInt(form.age) : undefined,
        weight_kg:           form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        height_cm:           form.height_cm ? parseFloat(form.height_cm) : undefined,
        body_fat_pct:        form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
        goal:                form.goal || undefined,
        allergies:           form.allergies || undefined,
        intolerances:        form.intolerances || undefined,
        dietary_preferences: form.dietary_preferences || undefined,
        lifestyle_notes:     form.lifestyle_notes || undefined,
      });
      Alert.alert('✓ Guardado', 'Perfil atualizado com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  async function joinNutritionist() {
    if (!inviteCode.trim() || joining) return;
    setJoining(true);
    try {
      await api.post('/api/clients/join', { code: inviteCode.trim().toUpperCase() });
      setInviteCode('');
      const updated = await api.get<Profile>('/api/profile');
      setProfile(updated);
      Alert.alert('Ligado!', 'O teu nutricionista já consegue ver as tuas refeições e dar feedback.');
    } catch {
      Alert.alert('Erro', 'Código inválido ou já utilizado.');
    } finally {
      setJoining(false);
    }
  }

  async function leaveNutritionist() {
    Alert.alert(
      'Deixar o nutricionista?',
      'Vais desligar-te do teu nutricionista. O histórico de refeições mantém-se. Podes ligar-te a outro depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desligar', style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await api.delete('/api/clients/leave');
              const updated = await api.get<Profile>('/api/profile');
              setProfile(updated);
            } catch {
              Alert.alert('Erro', 'Não foi possível desligar do nutricionista.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#4f46e5" />
      </SafeAreaView>
    );
  }

  const isAIMode = !profile.nutritionist_id;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-5 pb-10">

          {/* Page header */}
          <Text className="text-2xl font-bold text-slate-900 mb-1">Perfil</Text>
          <Text className="text-slate-400 text-sm mb-6">Gere os teus dados e acompanhamento</Text>

          {/* ── Mode card ─────────────────────────────────────────────── */}
          <View className="bg-white rounded-2xl border border-slate-100 p-4 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Modo de acompanhamento
            </Text>

            {isAIMode ? (
              <>
                {/* AI Coach mode */}
                <View className={`rounded-xl p-4 flex-row items-center gap-3 mb-3 ${
                  profile.ai_coach_enabled ? 'bg-brand-50 border border-brand-100' : 'bg-slate-50 border border-slate-200'
                }`}>
                  <View className={`w-10 h-10 rounded-xl items-center justify-center ${
                    profile.ai_coach_enabled ? 'bg-brand-600' : 'bg-slate-300'
                  }`}>
                    <Sparkles size={18} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-slate-900 text-sm">NutriCoach AI</Text>
                    <Text className={`text-xs mt-0.5 ${profile.ai_coach_enabled ? 'text-brand-600' : 'text-slate-400'}`}>
                      {profile.ai_coach_enabled ? 'Subscrição ativa' : 'Sem subscrição · 7 dias grátis'}
                    </Text>
                  </View>
                  {!profile.ai_coach_enabled && (
                    <TouchableOpacity
                      onPress={() => router.push('/(tabs)/coach')}
                      className="bg-brand-600 px-3 py-2 rounded-xl flex-row items-center gap-1"
                    >
                      <Text className="text-white text-xs font-bold">Ativar</Text>
                      <ChevronRight size={12} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Link to nutritionist */}
                <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Emparelhar com nutricionista
                </Text>
                <Text className="text-xs text-slate-400 mb-3 leading-4">
                  Se o teu nutricionista usa o NutriDesk, introduz o código de convite.
                  O Coach AI ficará desativado enquanto estiveres acompanhado.
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    placeholder="AB3X7YQP"
                    autoCapitalize="characters"
                    maxLength={8}
                    placeholderTextColor="#94a3b8"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center text-slate-900"
                  />
                  <TouchableOpacity
                    onPress={joinNutritionist}
                    disabled={joining || !inviteCode.trim()}
                    className={`px-4 rounded-xl items-center justify-center ${joining || !inviteCode.trim() ? 'bg-slate-200' : 'bg-nutrition-600'}`}
                  >
                    <Text className={`text-sm font-bold ${joining || !inviteCode.trim() ? 'text-slate-400' : 'text-white'}`}>
                      {joining ? '...' : 'Ligar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Nutritionist mode */}
                <View className="bg-nutrition-50 border border-nutrition-100 rounded-xl p-4 flex-row items-center gap-3 mb-3">
                  <View className="bg-nutrition-600 w-10 h-10 rounded-xl items-center justify-center">
                    <UserCheck size={18} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-slate-900 text-sm">Acompanhado por nutricionista</Text>
                    <Text className="text-xs text-nutrition-600 mt-0.5">
                      O teu nutricionista revê as tuas refeições
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={leaveNutritionist}
                  disabled={leaving}
                  className="flex-row items-center gap-2 py-2"
                >
                  <Link2Off size={14} color="#94a3b8" />
                  <Text className="text-slate-400 text-sm">
                    {leaving ? 'A desligar...' : 'Mudar para NutriCoach AI'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Body metrics ──────────────────────────────────────────── */}
          <View className="bg-white rounded-2xl border border-slate-100 p-5 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Dados pessoais
            </Text>

            <View className="space-y-4">
              <View>
                <Text className="text-xs text-slate-500 font-medium mb-1.5">Nome</Text>
                <TextInput
                  value={form.full_name}
                  onChangeText={update('full_name')}
                  placeholderTextColor="#94a3b8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900"
                />
              </View>

              {[
                { label: 'Idade', field: 'age' as const, unit: 'anos' },
                { label: 'Peso',  field: 'weight_kg' as const, unit: 'kg' },
                { label: 'Altura',field: 'height_cm' as const, unit: 'cm' },
                { label: 'Massa gorda', field: 'body_fat_pct' as const, unit: '%' },
              ].map((input) => (
                <View key={input.field}>
                  <Text className="text-xs text-slate-500 font-medium mb-1.5">{input.label}</Text>
                  <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <TextInput
                      value={form[input.field]}
                      onChangeText={update(input.field)}
                      keyboardType="numeric"
                      placeholderTextColor="#94a3b8"
                      className="flex-1 px-4 py-3 text-sm text-slate-900"
                    />
                    <Text className="px-4 text-slate-400 text-sm font-medium">{input.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── Goal ─────────────────────────────────────────────────── */}
          <View className="bg-white rounded-2xl border border-slate-100 p-5 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Objetivo</Text>
            <View className="space-y-2">
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setForm((f) => ({ ...f, goal: g.key }))}
                  className={`py-3 px-4 rounded-xl border-2 ${
                    form.goal === g.key ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${form.goal === g.key ? 'text-brand-700' : 'text-slate-600'}`}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Dietary restrictions ───────────────────────────────────── */}
          <View className="bg-white rounded-2xl border border-slate-100 p-5 mb-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Restrições alimentares
            </Text>
            <Text className="text-xs text-slate-400 mb-4">Usadas pelo coach para personalizar o feedback.</Text>
            <View className="space-y-4">
              {[
                { label: 'Alergias',              field: 'allergies' as const,           placeholder: 'ex: amendoins, marisco' },
                { label: 'Intolerâncias',         field: 'intolerances' as const,        placeholder: 'ex: lactose, glúten' },
                { label: 'Preferências',          field: 'dietary_preferences' as const, placeholder: 'ex: vegetariano, sem açúcar' },
                { label: 'Horários / estilo',     field: 'lifestyle_notes' as const,     placeholder: 'ex: trabalho por turnos, treino ao fim de tarde' },
              ].map((input) => (
                <View key={input.field}>
                  <Text className="text-xs text-slate-500 font-medium mb-1.5">{input.label}</Text>
                  <TextInput
                    value={form[input.field]}
                    onChangeText={update(input.field)}
                    placeholder={input.placeholder}
                    placeholderTextColor="#94a3b8"
                    multiline={input.field === 'lifestyle_notes'}
                    numberOfLines={input.field === 'lifestyle_notes' ? 2 : 1}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900"
                  />
                </View>
              ))}
            </View>
          </View>

          {/* ── Save ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className="bg-brand-600 rounded-xl py-4 items-center flex-row justify-center gap-2 mb-6"
            style={{ shadowColor: '#4f46e5', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
          >
            <Save size={17} color="white" />
            <Text className="text-white font-bold text-base">{saving ? 'A guardar...' : 'Guardar alterações'}</Text>
          </TouchableOpacity>

          {/* ── Sign out ──────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={signOut}
            className="flex-row items-center justify-center gap-2 py-3"
          >
            <LogOut size={15} color="#94a3b8" />
            <Text className="text-slate-400 text-sm">Terminar sessão</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
