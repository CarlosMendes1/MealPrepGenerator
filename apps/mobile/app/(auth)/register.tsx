import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Sparkles, Eye, EyeOff } from 'lucide-react-native';
import Button from '@/components/ui/Button';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';

export default function RegisterScreen() {
  const [form, setForm]             = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPass] = useState(false);
  const [inviteCode, setInviteCode]           = useState('');
  const [hasNutritionist, setHasNutritionist] = useState<boolean | null>(null);
  const [loading, setLoading]                 = useState(false);

  function update(field: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [field]: val }));
  }

  async function signUp() {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Campos em falta', 'Preenche todos os campos.');
      return;
    }
    if (form.password.length < 8) {
      Alert.alert('Palavra-passe curta', 'Mínimo 8 caracteres.');
      return;
    }
    if (hasNutritionist === null) {
      Alert.alert('Falta uma resposta', 'Indica se tens ou não nutricionista.');
      return;
    }
    if (hasNutritionist && !inviteCode.trim()) {
      Alert.alert('Código em falta', 'Introduz o código do teu nutricionista.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error) {
      setLoading(false);
      Alert.alert('Erro', error.message ?? 'Erro ao criar conta.');
      return;
    }

    // Supabase may require email confirmation — session may be null
    if (!data.session) {
      setLoading(false);
      Alert.alert(
        'Confirma o teu email',
        'Enviámos um link de confirmação para ' + form.email + '. Confirma antes de entrar.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }

    try {
      await api.post('/api/profile', { full_name: form.name, role: 'client' });
    } catch { /* profile may be created by DB trigger */ }

    if (hasNutritionist && inviteCode.trim()) {
      try {
        await api.post('/api/clients/join', { code: inviteCode.trim().toUpperCase() });
      } catch {
        Alert.alert(
          'Código inválido',
          'Conta criada com sucesso, mas o código do nutricionista é inválido. Liga-o mais tarde no Perfil.',
        );
      }
    }

    setLoading(false);
    router.replace('/(auth)/onboarding');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>

        {/* Hero */}
        <View className="bg-brand-600 pt-14 pb-10 px-6 rounded-b-[36px] overflow-hidden">
          <View className="absolute w-64 h-64 rounded-full bg-white/5" style={{ top: -40, right: -40 }} />
          <View className="bg-white/20 w-14 h-14 rounded-2xl items-center justify-center mb-4">
            <Sparkles size={28} color="white" />
          </View>
          <Text className="text-white text-2xl font-bold">NutriCoach AI</Text>
          <Text className="text-brand-200 text-sm mt-1">Começa o teu acompanhamento hoje</Text>
        </View>

        {/* Form */}
        <View className="px-6 pt-8 pb-8">
          <Text className="text-2xl font-bold text-slate-900 mb-1">Criar conta</Text>
          <Text className="text-slate-400 text-sm mb-6">É grátis começar</Text>

          {/* Basic fields */}
          <View className="space-y-4 mb-6">
            {(
              [
                { label: 'Nome', field: 'name' as const, placeholder: 'O teu nome', type: 'default' },
                { label: 'Email', field: 'email' as const, placeholder: 'o.teu@email.com', type: 'email-address' },
              ] as const
            ).map((input) => (
              <View key={input.field}>
                <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{input.label}</Text>
                <TextInput
                  value={form[input.field]}
                  onChangeText={update(input.field)}
                  keyboardType={input.type as any}
                  autoCapitalize={input.field === 'name' ? 'words' : 'none'}
                  placeholder={input.placeholder}
                  placeholderTextColor="#94a3b8"
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900"
                />
              </View>
            ))}

            {/* Password with show/hide toggle */}
            <View>
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Palavra-passe</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={form.password}
                  onChangeText={update('password')}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900"
                  style={{ paddingRight: 48 }}
                />
                <TouchableOpacity
                  onPress={() => setShowPass((v) => !v)}
                  style={{
                    position: 'absolute', right: 14, top: 0, bottom: 0,
                    justifyContent: 'center', alignItems: 'center',
                    width: 36, minHeight: 44,
                  }}
                  accessibilityLabel={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  accessibilityRole="button"
                >
                  {showPassword
                    ? <EyeOff size={18} color="#94a3b8" />
                    : <Eye size={18} color="#94a3b8" />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Nutritionist question */}
          <View className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
            <Text className="text-sm font-bold text-slate-800 mb-0.5">Tens um nutricionista?</Text>
            <Text className="text-xs text-slate-400 mb-4">
              Se sim, pede-lhe o código de convite NutriDesk.
            </Text>

            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                onPress={() => setHasNutritionist(true)}
                className={`flex-1 py-3 rounded-xl border-2 items-center ${
                  hasNutritionist === true ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                }`}
              >
                <Text className={`text-sm font-semibold ${hasNutritionist === true ? 'text-brand-700' : 'text-slate-500'}`}>
                  Sim
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setHasNutritionist(false); setInviteCode(''); }}
                className={`flex-1 py-3 rounded-xl border-2 items-center ${
                  hasNutritionist === false ? 'border-slate-800 bg-slate-800' : 'border-slate-200'
                }`}
              >
                <Text className={`text-sm font-semibold ${hasNutritionist === false ? 'text-white' : 'text-slate-500'}`}>
                  Não
                </Text>
              </TouchableOpacity>
            </View>

            {hasNutritionist === true && (
              <View>
                <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Código de convite</Text>
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Ex: AB3X7YQP"
                  autoCapitalize="characters"
                  maxLength={8}
                  placeholderTextColor="#94a3b8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base font-mono tracking-widest text-center text-slate-900"
                />
              </View>
            )}
          </View>

          <Button
            label="Criar conta"
            onPress={signUp}
            loading={loading}
            style={{ marginBottom: 24 }}
          />

          <View className="flex-row justify-center">
            <Text className="text-slate-400 text-sm">Já tens conta? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-brand-600 font-semibold text-sm">Entrar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
