/**
 * ContentOS - Browser Supabase Client
 * Safe for client components. Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DatabaseConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  serviceRoleKey?: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function isDatabaseConfigured(): boolean {
  const config = getDatabaseConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

let browserClient: SupabaseClient | null = null;

/**
 * Returns a browser-safe Supabase client (singleton pattern).
 * Returns null if Supabase credentials are not configured yet.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    return null;
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
}
