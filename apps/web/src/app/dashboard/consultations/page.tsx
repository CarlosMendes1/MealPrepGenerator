import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import ConsultationsClient from './ConsultationsClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchConsultations(token: string, from: string, to: string) {
  try {
    const res = await fetch(
      `${API_URL}/api/consultations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchClients(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ConsultationsPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  // Fetch a 3-month window: current week start → +12 weeks
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  weekStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(weekStart);
  rangeEnd.setDate(rangeEnd.getDate() + 7 * 12);

  const [consultations, clients] = await Promise.all([
    fetchConsultations(session.access_token, weekStart.toISOString(), rangeEnd.toISOString()),
    fetchClients(session.access_token),
  ]);

  return (
    <ConsultationsClient
      initialConsultations={consultations}
      clients={clients}
      token={session.access_token}
    />
  );
}
