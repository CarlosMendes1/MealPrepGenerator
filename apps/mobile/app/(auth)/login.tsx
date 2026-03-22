import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@/services/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', 'Email ou palavra-passe incorretos.');
    } else {
      router.replace('/(tabs)/');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-20 pb-8">
          <Text className="text-2xl font-bold text-brand-700 mb-12">NutriDesk</Text>

          <Text className="text-3xl font-bold text-gray-900 mb-2">Entrar</Text>
          <Text className="text-gray-400 mb-8">Bem-vindo de volta</Text>

          <View className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="o.teu@email.com"
                className="border border-gray-200 rounded-xl px-4 py-3.5 text-base"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Palavra-passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                className="border border-gray-200 rounded-xl px-4 py-3.5 text-base"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={signIn}
            disabled={loading}
            className="bg-brand-600 rounded-xl py-4 mt-8 items-center"
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'A entrar...' : 'Entrar'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-400 text-sm">Não tens conta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-brand-600 font-medium text-sm">Registar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
