import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Home, Camera, ClipboardList, User, Sparkles } from 'lucide-react-native';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';

export default function TabsLayout() {
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);

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
    loadFeedbackCount();

    const channel = supabase
      .channel('tab-badge-feedback')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meals' }, () => {
        loadFeedbackCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
