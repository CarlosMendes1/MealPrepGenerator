import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, role, goal, created_at')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Definições</h1>
      <SettingsForm profile={profile} token={session.access_token} />
    </div>
  );
}
