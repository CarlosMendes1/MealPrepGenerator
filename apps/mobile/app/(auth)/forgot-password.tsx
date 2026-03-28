import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  async function sendReset() {
    if (!email.trim()) return;
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);

    if (error) {
      showToast('Não foi possível enviar o email. Verifica o endereço.', 'error');
    } else {
      setSent(true);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-14 pb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>

          <Text className="text-3xl font-bold text-gray-900 mb-2">Recuperar palavra-passe</Text>
          <Text className="text-gray-400 mb-8">
            Envia-te um link para criares uma nova palavra-passe.
          </Text>

          {sent ? (
            <View className="bg-green-50 border border-green-100 rounded-2xl p-5 items-center">
              <CheckCircle size={40} color="#16a34a" />
              <Text className="font-bold text-green-800 text-lg mt-3 mb-2">Email enviado!</Text>
              <Text className="text-green-700 text-sm text-center leading-relaxed">
                Verifica a tua caixa de entrada e segue as instruções para redefinir a
                palavra-passe.
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className="mt-5 bg-brand-600 rounded-xl px-6 py-3"
              >
                <Text className="text-white font-semibold">Voltar ao login</Text>
              </TouchableOpacity>
            </View>
          ) : (
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

              <TouchableOpacity
                onPress={sendReset}
                disabled={loading || !email.trim()}
                className={`rounded-xl py-4 items-center mt-2 ${
                  loading || !email.trim() ? 'bg-gray-200' : 'bg-brand-600'
                }`}
              >
                <Text className={`font-semibold text-base ${
                  loading || !email.trim() ? 'text-gray-400' : 'text-white'
                }`}>
                  {loading ? 'A enviar...' : 'Enviar link de recuperação'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
