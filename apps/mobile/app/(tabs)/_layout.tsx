import { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import {
  ActivityIndicator, View, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Home, Camera, ClipboardList, User, Sparkles } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';

function CameraTabButton({ onPress, accessibilityState }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.cameraWrapper}
      accessibilityRole="button"
    >
      <View style={styles.cameraButton}>
        <Camera size={28} color="white" strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const [session, setSession]           = useState<Session | null | undefined>(undefined);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const [needsOnboarding, setNeedsOnboarding]   = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Check if user needs onboarding (no goal set yet)
  useEffect(() => {
    if (!session) { setNeedsOnboarding(false); return; }
    api.get<{ goal: string | null }>('/api/profile')
      .then((p) => setNeedsOnboarding(!p.goal))
      .catch(() => setNeedsOnboarding(false));
  }, [session]);

  async function loadFeedbackCount() {
    try {
      const meals = await api.get<any[]>('/api/meals?limit=50');
      setNewFeedbackCount(meals.filter((m) => m.feedback_status === 'sent').length);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!session) return;
    loadFeedbackCount();
    const channel = supabase
      .channel('tab-badge-feedback')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals' }, loadFeedbackCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  if (session === undefined || needsOnboarding === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (needsOnboarding) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#c7d2fe',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Home color={color} size={22} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Refeições',
          tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} strokeWidth={1.8} />,
          tabBarBadge: newFeedbackCount > 0 ? newFeedbackCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#059669', fontSize: 10 },
        }}
      />
      {/* ── Centre raised button ── */}
      <Tabs.Screen
        name="camera"
        options={{
          title: '',
          tabBarButton: (props) => <CameraTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color }) => <Sparkles color={color} size={22} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e7ff',
    elevation: 16,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  cameraWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -24,
  },
  cameraButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
});
