/**
 * ContentOS - Privileged Admin Supabase Client
 *
 * CRITICAL SECURITY BOUNDARY:
 * - Uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security for trusted background orchestration.
 * - Guarded by `import 'server-only'`. Any attempt to import this into client components will fail build-time.
 * - NEVER expose or pass this client to browser code.
 */

import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase Admin Client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export function isAdminConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      key &&
      !key.startsWith('YOUR_') &&
      !key.startsWith('your-') &&
      !key.startsWith('sb_publish') &&
      (!pubKey || key !== pubKey)
  );
}
