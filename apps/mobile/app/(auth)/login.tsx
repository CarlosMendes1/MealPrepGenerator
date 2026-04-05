import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { supabase } from '@/services/supabase';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

WebBrowser.maybeCompleteAuthSession();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse access_token / refresh_token from redirect URL hash or query string */
function extractTokensFromUrl(url: string) {
  const hash   = url.split('#')[1] ?? '';
  const query  = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(hash || query);
  return {
    access_token:  params.get('access_token')  ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
  };
}

// ── Google "G" icon ───────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <View style={styles.socialIconBox}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

// ── Apple icon ────────────────────────────────────────────────────────────────

function AppleIcon() {
  return (
    <View style={styles.socialIconBox}>
      <Text style={styles.appleA}></Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // ── Email/password ──────────────────────────────────────────────────────
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

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error('No URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const { access_token, refresh_token } = extractTokensFromUrl(result.url);
        if (access_token) {
          await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token ?? '',
          });
        }
        // Fallback: let the auth state change listener pick up the session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) router.replace('/(tabs)/');
      }
    } catch {
      showToast('Não foi possível iniciar sessão com Google. Verifica a configuração.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Apple Sign-In ────────────────────────────────────────────────────────
  async function signInWithApple() {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;
      router.replace('/(tabs)/');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        showToast('Não foi possível iniciar sessão com Apple.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
    >
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />
          <View style={styles.heroIcon}>
            <Sparkles size={28} color="white" />
          </View>
          <Text style={styles.heroTitle}>NutriCoach AI</Text>
          <Text style={styles.heroSub}>O teu coach de nutrição pessoal</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>Entra na tua conta para continuar</Text>

          {/* ── Social login ── */}
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={signInWithGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            <GoogleIcon />
            <Text style={styles.socialBtnText}>Continuar com Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialBtn, styles.appleBtnDark]}
              onPress={signInWithApple}
              disabled={loading}
              activeOpacity={0.8}
            >
              <AppleIcon />
              <Text style={[styles.socialBtnText, { color: '#fff' }]}>Continuar com Apple</Text>
            </TouchableOpacity>
          )}

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou entra com email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Email + password ── */}
          <View style={{ gap: 12, marginBottom: 8 }}>
            <View>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="o.teu@email.com"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Palavra-passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </View>
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={{ alignItems: 'flex-end', paddingVertical: 10, marginBottom: 8 }}>
              <Text style={styles.forgotText}>Esqueceste a palavra-passe?</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            onPress={signIn}
            disabled={loading}
            style={styles.primaryBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? 'A entrar...' : 'Entrar'}
            </Text>
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Não tens conta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLink}>Criar conta grátis</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Config note */}
          <View style={styles.configNote}>
            <Text style={styles.configNoteText}>
              Google e Apple requerem configuração no painel Supabase → Authentication → Providers
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Hero
  hero: {
    backgroundColor: '#4f46e5',
    paddingTop: 64, paddingBottom: 48, paddingHorizontal: 24,
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  heroCircle1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50,
  },
  heroCircle2: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)', top: 20, right: 40,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub:   { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  // Form
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  title:    { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },

  // Social
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  appleBtnDark: {
    backgroundColor: '#000', borderColor: '#000',
  },
  socialIconBox: {
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
  },
  googleG: {
    fontSize: 16, fontWeight: '800',
    color: '#4285F4',
  },
  appleA: {
    fontSize: 18, fontWeight: '700', color: '#fff',
    lineHeight: 22,
  },
  socialBtnText: {
    fontSize: 15, fontWeight: '600', color: '#0f172a',
  },

  // Divider
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  // Fields
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#0f172a',
  },
  forgotText: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },

  // Primary button
  primaryBtn: {
    backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Register link
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { fontSize: 14, color: '#94a3b8' },
  registerLink: { fontSize: 14, fontWeight: '700', color: '#4f46e5' },

  // Config note
  configNote: {
    marginTop: 24, backgroundColor: '#f0fdf4', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  configNoteText: { fontSize: 11, color: '#15803d', textAlign: 'center', lineHeight: 17 },
});
