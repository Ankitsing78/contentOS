import { NextResponse } from 'next/server';
import {
  isDatabaseConfigured,
  getDatabaseConfig,
  createServerClient,
  isAdminConfigured,
  getAdminClient,
} from '@/lib/database';
import { isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbConfigured = isDatabaseConfigured();
  const adminConfigured = isAdminConfigured();
  const storageConfigured = isStorageConfigured();
  const config = getDatabaseConfig();

  const statusResponse: {
    system: string;
    timestamp: string;
    database: {
      configured: boolean;
      urlConfigured: boolean;
      anonKeyConfigured: boolean;
      serviceRoleConfigured: boolean;
      connectionCheck: 'connected' | 'not_configured' | 'connection_failed';
      message?: string;
    };
    storage: {
      configured: boolean;
      bucket: string;
    };
  } = {
    system: 'ContentOS Core',
    timestamp: new Date().toISOString(),
    database: {
      configured: dbConfigured,
      urlConfigured: Boolean(config.supabaseUrl),
      anonKeyConfigured: Boolean(config.supabaseAnonKey),
      serviceRoleConfigured: adminConfigured,
      connectionCheck: 'not_configured',
    },
    storage: {
      configured: storageConfigured,
      bucket: 'content-assets',
    },
  };

  // Safe server ping without printing secret values
  if (dbConfigured) {
    try {
      const serverClient = createServerClient();
      if (serverClient) {
        const { error } = await serverClient
          .from('content_projects')
          .select('id')
          .limit(1);

        if (error) {
          statusResponse.database.connectionCheck = 'connection_failed';
          statusResponse.database.message = error.message;
        } else {
          statusResponse.database.connectionCheck = 'connected';
        }
      }

      // If admin client is also configured, verify admin connection
      if (adminConfigured && statusResponse.database.connectionCheck === 'connected') {
        const admin = getAdminClient();
        const { error: adminError } = await admin
          .from('content_projects')
          .select('id')
          .limit(1);

        if (adminError) {
          statusResponse.database.message = `Admin ping: ${adminError.message}`;
        }
      }
    } catch (err: unknown) {
      statusResponse.database.connectionCheck = 'connection_failed';
      statusResponse.database.message =
        err instanceof Error ? err.message : 'Unknown connection error';
    }
  }

  return NextResponse.json(statusResponse);
}
