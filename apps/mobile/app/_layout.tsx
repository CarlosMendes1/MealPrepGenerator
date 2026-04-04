import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Get initial session and redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(true);
      if (session) {
        router.replace('/(tabs)/');
      } else {
        router.replace('/(auth)/login');
      }
    });

    // Keep listening for auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/(tabs)/');
      } else {
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
