import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Send, Zap, Lock, ArrowRight, UserCheck } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// ── Quick suggestion chips ────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Como aumentar a minha ingestão de proteína?',
  'O que comer antes de treinar?',
  'Estou com fome à noite. O que fazer?',
  'Avalia o meu progresso desta semana',
];

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      ).start();

    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={styles.typingRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.avatarCircle}>
          <Sparkles size={14} color="#fff" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {message.streaming ? (
          <TypingIndicator />
        ) : (
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Upsell screen ─────────────────────────────────────────────────────────────

function UpsellScreen() {
  const features = [
    'Respostas em tempo real sobre nutrição',
    'Análise automática das tuas refeições',
    'Sugestões personalizadas ao teu objetivo',
    'Dicas de lifestyle e hábitos saudáveis',
    'Histórico de conversas guardado',
  ];

  return (
    <View style={styles.upsellContainer}>
      <View style={styles.upsellCard}>
        <View style={styles.upsellIconCircle}>
          <Sparkles size={32} color="#fff" />
        </View>
        <Text style={styles.upsellTitle}>NutriCoach AI</Text>
        <Text style={styles.upsellSubtitle}>
          O teu assistente de nutrição inteligente, disponível 24/7 para te ajudar a atingir os teus objetivos.
        </Text>

        <View style={styles.upsellFeatures}>
          {features.map((f) => (
            <View key={f} style={styles.upsellFeatureRow}>
              <View style={styles.upsellCheck} />
              <Text style={styles.upsellFeatureText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.upsellPriceCard}>
          <Lock size={14} color="#6366f1" />
          <Text style={styles.upsellPriceText}>A partir de €9/mês</Text>
        </View>

        <TouchableOpacity
          style={styles.upsellCta}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Zap size={16} color="#fff" />
          <Text style={styles.upsellCtaText}>Ativar NutriCoach</Text>
          <ArrowRight size={16} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.upsellNote}>
          Vai a Perfil → Definições para ativar. Trial de 7 dias gratuito.
        </Text>
      </View>
    </View>
  );
}

// ── Blocked screen (has human nutritionist) ───────────────────────────────────

function BlockedScreen() {
  return (
    <View style={styles.upsellContainer}>
      <View style={styles.upsellCard}>
        <View style={[styles.upsellIconCircle, { backgroundColor: '#f3f4f6' }]}>
          <UserCheck size={32} color="#6b7280" />
        </View>
        <Text style={styles.upsellTitle}>Coach não disponível</Text>
        <Text style={styles.upsellSubtitle}>
          Já tens um nutricionista a acompanhar-te. O NutriCoach AI está desativado para não interferir com o teu acompanhamento humano.
        </Text>

        <View style={[styles.upsellPriceCard, { backgroundColor: '#f0fdf4', marginBottom: 0 }]}>
          <UserCheck size={14} color="#16a34a" />
          <Text style={[styles.upsellPriceText, { color: '#16a34a' }]}>
            O teu nutricionista está a acompanhar-te
          </Text>
        </View>

        <Text style={[styles.upsellNote, { marginTop: 20 }]}>
          Se tiveres dúvidas rápidas, fala com o teu nutricionista através da consulta agendada.
        </Text>
      </View>
    </View>
  );
}

// ── Main coach screen ─────────────────────────────────────────────────────────

export default function CoachScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [enabled, setEnabled]         = useState(false);
  const [hasNutritionist, setHasNutritionist] = useState(false);
  const [token, setToken]             = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ── Load profile + history ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        setToken(session.access_token);

        // Check nutritionist + feature flag
        const { data: profile } = await supabase
          .from('profiles')
          .select('ai_coach_enabled, nutritionist_id')
          .eq('user_id', session.user.id)
          .single();

        if (profile?.nutritionist_id) { setHasNutritionist(true); setLoading(false); return; }
        if (!profile?.ai_coach_enabled) { setLoading(false); return; }
        setEnabled(true);

        // Load chat history
        const res = await fetch(`${API_URL}/api/coach/history`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const history = await res.json();
          setMessages(
            history.map((m: { id: string; role: 'user' | 'assistant'; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Scroll to bottom on new messages ──────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // ── Send message with streaming ────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !token) return;

    setInput('');
    setSending(true);

    const userMsgId = `user-${Date.now()}`;
    const aiBubbleId = `ai-${Date.now()}`;

    // Add user message
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: trimmed }]);
    // Add AI typing placeholder
    setMessages((prev) => [...prev, { id: aiBubbleId, role: 'assistant', content: '', streaming: true }]);

    // Build recent history for context (last 10 messages)
    const historyForApi = messages
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch(`${API_URL}/api/coach/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed, history: historyForApi }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiBubbleId
              ? { ...m, content: err.message ?? 'Erro ao obter resposta.', streaming: false }
              : m
          )
        );
        return;
      }

      // Stream SSE events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (!reader) throw new Error('No readable stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiBubbleId
                    ? { ...m, content: accumulated, streaming: false }
                    : m
                )
              );
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiBubbleId
                    ? { ...m, content: parsed.error, streaming: false }
                    : m
                )
              );
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiBubbleId
            ? { ...m, content: 'Erro de ligação. Tenta novamente.', streaming: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [sending, token, messages]);

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    );
  }

  // ── Blocked (has nutritionist) ────────────────────────────────────────
  if (hasNutritionist) return <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}><BlockedScreen /></SafeAreaView>;

  // ── Upsell (no subscription) ──────────────────────────────────────────
  if (!enabled) return <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}><UpsellScreen /></SafeAreaView>;

  // ── Chat ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Sparkles size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>NutriCoach</Text>
            <Text style={styles.headerSub}>AI · Sempre disponível</Text>
          </View>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>AI</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Sparkles size={28} color="#6366f1" />
              </View>
              <Text style={styles.emptyTitle}>Olá! Sou o teu NutriCoach 👋</Text>
              <Text style={styles.emptySub}>
                Estou aqui para te ajudar com dúvidas de nutrição, analisar as tuas refeições e apoiar-te a atingir os teus objetivos.
              </Text>

              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => sendMessage(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Escreve a tua mensagem…"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size={16} color="#fff" />
              : <Send size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  container: { flex: 1, backgroundColor: '#f9fafb' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:  { fontSize: 15, fontWeight: '700', color: '#111827' },
  headerSub:    { fontSize: 11, color: '#9ca3af' },
  headerBadge:  {
    backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#6366f1' },

  // Messages
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  bubbleRow:     { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start' },

  avatarCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },

  bubble:     { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#16a34a', borderBottomRightRadius: 4 },
  bubbleAI:   { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },

  bubbleText:     { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAI:   { color: '#111827' },

  // Typing indicator
  typingRow: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#9ca3af' },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 16 },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: '#6b7280', lineHeight: 22, textAlign: 'center', marginBottom: 24 },

  suggestions:    { width: '100%', gap: 8 },
  suggestionChip: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  suggestionText: { fontSize: 13, color: '#374151' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  input: {
    flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#111827', maxHeight: 100,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#c7d2fe' },

  // Upsell
  upsellContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  upsellCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    alignItems: 'center',
  },
  upsellIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  upsellTitle:    { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  upsellSubtitle: {
    fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 20,
  },
  upsellFeatures: { width: '100%', gap: 10, marginBottom: 20 },
  upsellFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upsellCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  upsellFeatureText: { fontSize: 14, color: '#374151' },

  upsellPriceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eef2ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 16,
  },
  upsellPriceText: { fontSize: 14, fontWeight: '600', color: '#6366f1' },

  upsellCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366f1', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14, width: '100%', justifyContent: 'center',
    marginBottom: 12,
  },
  upsellCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  upsellNote:    { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
});
