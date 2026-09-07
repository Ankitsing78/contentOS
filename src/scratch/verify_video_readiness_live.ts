import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { VideoRenderingAgent } from '@/lib/services/video-rendering-agent';
import { MissingAssetsError } from '@/lib/media/composition-validator';

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const projectId = '87c7b326-377e-4df0-8ce3-6287233fed32';
  const userId = '4650f484-7f61-4f5a-89b4-78e87fcae2e5';
  const jobId = 'e94adf1b-f7fb-406c-a5de-2fe9304814ba';

  const agent = new VideoRenderingAgent();

  console.log('====================================================');
  console.log('  ContentOS Video Composition Live Readiness Check  ');
  console.log('====================================================\n');

  console.log(`Checking readiness for project: ${projectId}`);
  const { readiness, packageId } = await agent.checkReadiness(supabase, projectId);

  console.log(`\nProduction Package ID: ${packageId}`);
  console.log(`Can Render: ${readiness.canRender ? 'READY' : 'BLOCKED'}`);
  console.log(`Total Scenes: ${readiness.totalScenes}`);
  console.log(`Completed Scenes: ${readiness.completedScenes}`);
  console.log(`Timing Errors Count: ${readiness.timingErrors.length}`);
  console.log(`Ready Assets: Visuals=${readiness.readyAssets.visuals}, Audio=${readiness.readyAssets.audios}, Captions=${readiness.readyAssets.captions}`);
  console.log(`Missing Visuals Count: ${readiness.missingVisuals.length}`);
  console.log(`Missing Audio Count: ${readiness.missingAudios.length}`);

  if (readiness.missingVisuals.length > 0) {
    console.log('\n--- Missing Visual Requirements Breakdown ---');
    for (const v of readiness.missingVisuals) {
      console.log(`  • Scene #${v.sceneOrder} (${v.requirementId}): Status="${v.status}" | Prompt="${v.prompt.slice(0, 60)}..."`);
    }
  }

  console.log('\n--- Testing Strict Non-Placeholder Execution Enforcement ---');
  try {
    await agent.execute({
      client: supabase,
      projectId,
      userId,
      jobId,
    });
    console.error('FAIL: Expected execution to be blocked, but it succeeded!');
  } catch (err: unknown) {
    if (err instanceof MissingAssetsError) {
      console.log('SUCCESS: Execution was strictly blocked as expected:');
      console.log(`  Message: ${err.message}`);
      console.log(`  Missing Count: ${err.readiness.missingVisuals.length}`);
    } else {
      console.error('Unexpected error type:', err);
    }
  }

  console.log('\n====================================================');
}

main().catch(console.error);
