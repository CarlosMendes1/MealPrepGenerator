import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import MembersClient from './MembersClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getOrgAndMembers(token: string) {
  const mineRes = await fetch(`${API_URL}/api/organizations/mine`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!mineRes.ok) return null;
  const mine = await mineRes.json();
  if (!mine) return null;

  const membersRes = await fetch(`${API_URL}/api/organizations/${mine.organizations.id}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const members = membersRes.ok ? await membersRes.json() : [];

  return { org: mine.organizations, role: mine.role, members };
}

export default async function MembersPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const data = await getOrgAndMembers(session.access_token);
  if (!data) redirect('/create-organization');
  if (data.role === 'member') redirect('/dashboard');

  return (
    <MembersClient
      org={data.org}
      members={data.members}
      currentUserId={user.id}
      userRole={data.role}
      token={session.access_token}
    />
  );
}
