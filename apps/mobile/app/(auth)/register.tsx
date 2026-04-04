'use client';
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';

export default function RegisterScreen() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [hasNutritionist, setHasNutritionist] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [field]: val }));
  }

  async function signUp() {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Erro', 'Preenche todos os campos.');
      return;
    }
    if (form.password.length < 8) {
      Alert.alert('Erro', 'A palavra-passe deve ter pelo menos 8 caracteres.');
      return;
    }
    if (hasNutritionist === null) {
      Alert.alert('Erro', 'Indica se tens ou não nutricionista.');
      return;
    }
    if (hasNutritionist && !inviteCode.trim()) {
      Alert.alert('Erro', 'Introduz o código do teu nutricionista.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error || !data.session) {
      setLoading(false);
      Alert.alert('Erro', error?.message ?? 'Erro ao criar conta.');
      return;
    }

    try {
      await api.post('/api/profile', { full_name: form.name, role: 'client' });
    } catch {
      // Non-fatal if trigger handles it
    }

    if (hasNutritionist && inviteCode.trim()) {
      try {
        await api.post('/api/clients/join', { code: inviteCode.trim().toUpperCase() });
      } catch {
        Alert.alert(
          'Código inválido',
          'A conta foi criada mas o código do nutricionista é inválido. Podes ligá-lo mais tarde no Perfil.',
        );
      }
    }

    setLoading(false);
    router.replace('/(auth)/onboarding');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-20 pb-8">
          <Text className="text-2xl font-bold text-brand-700 mb-12">NutriDesk</Text>

          <Text className="text-3xl font-bold text-gray-900 mb-2">Criar conta</Text>
          <Text className="text-gray-400 mb-8">Começa o teu acompanhamento</Text>

          {/* Basic fields */}
          <View className="space-y-4 mb-6">
            {[
              { label: 'Nome', field: 'name' as const, placeholder: 'O teu nome', type: 'default' },
              { label: 'Email', field: 'email' as const, placeholder: 'o.teu@email.com', type: 'email-address' },
              { label: 'Palavra-passe', field: 'password' as const, placeholder: '••••••••', type: 'default', secure: true },
            ].map((input) => (
              <View key={input.field}>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">{input.label}</Text>
                <TextInput
                  value={form[input.field]}
                  onChangeText={update(input.field)}
                  keyboardType={input.type as any}
                  autoCapitalize={input.field === 'name' ? 'words' : 'none'}
                  secureTextEntry={input.secure}
                  placeholder={input.placeholder}
                  className="border border-gray-200 rounded-xl px-4 py-3.5 text-base"
                />
              </View>
            ))}
          </View>

          {/* Nutritionist question */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-6">
            <Text className="text-sm font-semibold text-gray-800 mb-1">
              Tens um nutricionista?
            </Text>
            <Text className="text-xs text-gray-400 mb-3">
              Se sim, pede-lhe o código de convite NutriDesk.
            </Text>
            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity
                onPress={() => setHasNutritionist(true)}
                className={`flex-1 py-2.5 rounded-xl border-2 items-center ${
                  hasNutritionist === true
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text className={`text-sm font-medium ${hasNutritionist === true ? 'text-brand-700' : 'text-gray-600'}`}>
                  Sim
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setHasNutritionist(false); setInviteCode(''); }}
                className={`flex-1 py-2.5 rounded-xl border-2 items-center ${
                  hasNutritionist === false
                    ? 'border-gray-800 bg-gray-800'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text className={`text-sm font-medium ${hasNutritionist === false ? 'text-white' : 'text-gray-600'}`}>
                  Não
                </Text>
              </TouchableOpacity>
            </View>

            {hasNutritionist === true && (
              <View>
                <Text className="text-xs text-gray-500 mb-1.5">Código de convite</Text>
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Ex: AB3X7YQP"
                  autoCapitalize="characters"
                  maxLength={8}
                  className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base font-mono tracking-widest text-center"
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={signUp}
            disabled={loading}
            className="bg-brand-600 rounded-xl py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'A criar conta...' : 'Criar conta'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-400 text-sm">Já tens conta? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-brand-600 font-medium text-sm">Entrar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
