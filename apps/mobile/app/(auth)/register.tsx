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

          <View className="space-y-4">
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

          <TouchableOpacity
            onPress={signUp}
            disabled={loading}
            className="bg-brand-600 rounded-xl py-4 mt-8 items-center"
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
