import { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Home, Camera, ClipboardList, User, Sparkles } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';

export default function TabsLayout() {
  const [session, setSession]           = useState<Session | null | undefined>(undefined);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);

  // Gate: verify session before rendering any tab screen
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  async function loadFeedbackCount() {
    try {
      const meals = await api.get<any[]>('/api/meals?limit=50');
      const count = meals.filter((m) => m.feedback_status === 'sent').length;
      setNewFeedbackCount(count);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    if (!session) return;
    loadFeedbackCount();

    const channel = supabase
      .channel('tab-badge-feedback')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals' }, () => {
        loadFeedbackCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // Still resolving session from storage
  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // No session → redirect to login
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopColor: '#f3f4f6',
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Registar',
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Refeições',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
          tabBarBadge: newFeedbackCount > 0 ? newFeedbackCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#16a34a', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
          tabBarActiveTintColor: '#6366f1',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
