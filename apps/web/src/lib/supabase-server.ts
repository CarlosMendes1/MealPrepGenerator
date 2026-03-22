import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client suitable for use in Server Components and Route Handlers.
 * Uses Next.js cookie store for session management.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — reads are fine, writes are a no-op.
          }
        },
      },
    }
  );
}

/**
 * Validates the current session against the Supabase Auth server.
 * Prefer this over getSession() which only reads the local JWT.
 *
 * Returns null if the user is not authenticated or the token is invalid/expired.
 */
export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}
