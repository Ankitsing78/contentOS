/**
 * ContentOS - Server Supabase Client
 * Safe for server components, server actions, and API routes.
 */

import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client using anon key.
 * Can be supplied with an optional user auth token header for RLS enforcement.
 */
export function createServerClient(userAccessToken?: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: userAccessToken
      ? {
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
          },
        }
      : undefined,
  });
}
