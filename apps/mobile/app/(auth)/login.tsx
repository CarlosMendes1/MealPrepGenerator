import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  async function signIn() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      showToast('Email ou palavra-passe incorretos.', 'error');
    } else {
      router.replace('/(tabs)/');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>

        {/* Hero */}
        <View className="bg-brand-600 pt-16 pb-12 px-6 rounded-b-[36px] overflow-hidden">
          <View className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5" style={{ top: -40, right: -40 }} />
          <View className="absolute w-32 h-32 rounded-full bg-white/5" style={{ top: 20, right: 40 }} />

          <View className="bg-white/20 w-14 h-14 rounded-2xl items-center justify-center mb-5">
            <Sparkles size={28} color="white" />
          </View>
          <Text className="text-white text-2xl font-bold tracking-tight">NutriCoach AI</Text>
          <Text className="text-brand-200 text-sm mt-1">O teu coach de nutrição pessoal</Text>
        </View>

        {/* Form */}
        <View className="flex-1 px-6 pt-8 pb-8">
          <Text className="text-2xl font-bold text-slate-900 mb-1">Bem-vindo de volta</Text>
          <Text className="text-slate-400 text-sm mb-8">Entra na tua conta para continuar</Text>

          <View className="space-y-4 mb-2">
            <View>
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="o.teu@email.com"
                placeholderTextColor="#94a3b8"
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900"
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Palavra-passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900"
              />
            </View>
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity className="items-end py-3 mb-4">
              <Text className="text-brand-600 text-sm font-medium">Esqueceste a palavra-passe?</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            onPress={signIn}
            disabled={loading}
            className="bg-brand-600 rounded-xl py-4 items-center shadow-sm mb-6"
            style={{ shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          >
            <Text className="text-white font-bold text-base">
              {loading ? 'A entrar...' : 'Entrar'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center">
            <Text className="text-slate-400 text-sm">Não tens conta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-brand-600 font-semibold text-sm">Criar conta grátis</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
