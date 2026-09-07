/**
 * ContentOS - Script Persistence Repository
 * Manages database persistence for Scripts, Sections, Source References, and Pipeline Stages.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScriptPackage } from '@/types';

export interface PersistScriptInput {
  client: SupabaseClient;
  projectId: string;
  jobId: string;
  userId: string;
  scriptPackage: ScriptPackage;
  model?: string;
  rawJson?: string;
}

export interface PersistScriptResult {
  masterScriptId?: string;
  stageId?: string;
  agentRunId?: string;
}

export async function persistScriptExecution(
  input: PersistScriptInput
): Promise<PersistScriptResult> {
  const {
    client,
    projectId,
    jobId,
    userId,
    scriptPackage,
    model = 'gemini-3.6-flash',
    rawJson,
  } = input;
  const completedTime = new Date().toISOString();

  let masterScriptId: string | undefined;
  let stageId: string | undefined;
  let agentRunId: string | undefined;

  // 1. Fetch available research sources to map source_ids
  const { data: dbSources } = await client
    .from('research_sources')
    .select('id, title, url')
    .eq('project_id', projectId);

  const resolveSourceId = (title: string, url?: string): string | null => {
    if (!dbSources || dbSources.length === 0) return null;
    const matched = dbSources.find(
      (s) =>
        (url && s.url && s.url.toLowerCase().trim() === url.toLowerCase().trim()) ||
        (title && s.title.toLowerCase().trim() === title.toLowerCase().trim())
    );
    return matched?.id || null;
  };

  // 2. Persist to normalized script tables
  try {
    const master = scriptPackage.master_script;
    const { data: masterRow, error: masterErr } = await client
      .from('scripts')
      .insert({
        project_id: projectId,
        job_id: jobId,
        user_id: userId,
        title: master.title,
        format: master.format,
        platform: 'master',
        target_duration_seconds: master.target_duration_seconds,
        estimated_duration_seconds: master.estimated_duration_seconds,
        word_count: master.word_count,
        language: master.language,
        tone: master.tone,
        hook: master.hook,
        cta: master.cta,
        version: master.version,
        is_mock_data: master.is_mock_data,
        metadata: {
          unresolved_claims: master.unresolved_claims,
          consistency_notes: scriptPackage.consistency_notes,
          overall_confidence: scriptPackage.overall_confidence,
        },
      })
      .select('id')
      .single();

    if (masterRow?.id) {
      masterScriptId = masterRow.id;
      console.log('[ContentOS] [Repository] Master script persisted:', masterScriptId);

      // Persist master script sections
      for (const sec of master.sections) {
        const { data: secRow } = await client
          .from('script_sections')
          .insert({
            script_id: masterScriptId,
            user_id: userId,
            section_order: sec.order,
            section_type: sec.type,
            start_second: sec.start_second,
            end_second: sec.end_second,
            spoken_text: sec.spoken_text,
            visual_direction: sec.visual_direction,
            b_roll_suggestions: sec.b_roll_suggestions,
            on_screen_text: sec.on_screen_text || null,
          })
          .select('id')
          .single();

        // Persist section source references
        if (secRow?.id && sec.source_references && sec.source_references.length > 0) {
          const refInserts = sec.source_references.map((r) => ({
            section_id: secRow.id,
            source_id: resolveSourceId(r.source_title, r.source_url),
            user_id: userId,
            claim: r.claim,
            source_title: r.source_title,
            source_url: r.source_url || '',
            usage_note: r.usage_note || null,
          }));

          await client.from('script_source_references').insert(refInserts);
        }
      }

      // Persist platform variants
      for (const variant of scriptPackage.platform_variants) {
        const { data: variantRow } = await client
          .from('scripts')
          .insert({
            project_id: projectId,
            job_id: jobId,
            user_id: userId,
            title: variant.title,
            format: variant.format,
            platform: variant.platform,
            target_duration_seconds: variant.target_duration_seconds,
            estimated_duration_seconds: variant.estimated_duration_seconds,
            word_count: variant.word_count,
            language: master.language,
            tone: master.tone,
            hook: variant.hook,
            cta: variant.cta,
            version: 1,
            is_mock_data: master.is_mock_data,
            metadata: {
              platform_adjustments: variant.platform_adjustments,
            },
          })
          .select('id')
          .single();

        if (variantRow?.id) {
          for (const sec of variant.sections) {
            const { data: secRow } = await client
              .from('script_sections')
              .insert({
                script_id: variantRow.id,
                user_id: userId,
                section_order: sec.order,
                section_type: sec.type,
                start_second: sec.start_second,
                end_second: sec.end_second,
                spoken_text: sec.spoken_text,
                visual_direction: sec.visual_direction,
                b_roll_suggestions: sec.b_roll_suggestions,
                on_screen_text: sec.on_screen_text || null,
              })
              .select('id')
              .single();

            if (secRow?.id && sec.source_references && sec.source_references.length > 0) {
              const refInserts = sec.source_references.map((r) => ({
                section_id: secRow.id,
                source_id: resolveSourceId(r.source_title, r.source_url),
                user_id: userId,
                claim: r.claim,
                source_title: r.source_title,
                source_url: r.source_url || '',
                usage_note: r.usage_note || null,
              }));
              await client.from('script_source_references').insert(refInserts);
            }
          }
        }
      }
    } else if (masterErr) {
      console.warn('[ContentOS] [Repository] Notice inserting scripts table:', masterErr.message);
    }
  } catch (err: unknown) {
    console.warn(
      '[ContentOS] [Repository] Normalized script tables notice:',
      err instanceof Error ? err.message : 'Notice'
    );
  }

  // 2b. Persist to existing content_scripts table (from 0001 schema)
  try {
    for (const variant of scriptPackage.platform_variants) {
      if (['youtube', 'instagram', 'x'].includes(variant.platform)) {
        const fullContent = variant.sections
          .map(
            (s) =>
              `[${s.type.toUpperCase()}] (${s.start_second}s - ${s.end_second}s)\n${s.spoken_text}\nVisual: ${
                s.visual_direction || 'None'
              }\nOverlay: ${s.on_screen_text || 'None'}`
          )
          .join('\n\n');

        await client
          .from('content_scripts')
          .upsert(
            {
              project_id: projectId,
              platform: variant.platform,
              version: 1,
              content: fullContent,
              metadata: {
                title: variant.title,
                hook: variant.hook,
                cta: variant.cta,
                target_duration: variant.target_duration_seconds,
                estimated_duration: variant.estimated_duration_seconds,
                word_count: variant.word_count,
                platform_adjustments: variant.platform_adjustments,
                sections: variant.sections,
                source_references: variant.source_references,
                is_mock_data: scriptPackage.is_mock_data,
              },
              updated_at: completedTime,
            },
            { onConflict: 'project_id,platform,version' }
          );
      }
    }
    console.log('[ContentOS] [Repository] content_scripts persisted successfully');
  } catch (csErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Notice updating content_scripts:',
      csErr instanceof Error ? csErr.message : 'Notice'
    );
  }

  // 3. Pipeline tracking: Update job_stages for 'script_generation'
  try {
    const { data: existingStage } = await client
      .from('job_stages')
      .select('id')
      .eq('job_id', jobId)
      .eq('stage', 'script_generation')
      .maybeSingle();

    if (existingStage?.id) {
      stageId = existingStage.id;
      await client
        .from('job_stages')
        .update({
          status: 'completed',
          output: scriptPackage as unknown as Record<string, unknown>,
          completed_at: completedTime,
        })
        .eq('id', stageId);
    } else {
      const { data: newStage } = await client
        .from('job_stages')
        .insert({
          job_id: jobId,
          stage: 'script_generation',
          status: 'completed',
          attempt: 1,
          input: {
            master_title: scriptPackage.master_script.title,
            target_duration: scriptPackage.master_script.target_duration_seconds,
          },
          output: scriptPackage as unknown as Record<string, unknown>,
          started_at: completedTime,
          completed_at: completedTime,
        })
        .select('id')
        .single();
      stageId = newStage?.id;
    }
    console.log('[ContentOS] [Repository] script_generation stage tracked:', stageId);
  } catch (stageErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Failed to update script_generation stage:',
      stageErr instanceof Error ? stageErr.message : 'Unknown'
    );
  }

  // 4. Audit history: Record in agent_runs
  try {
    const { data: runRow } = await client
      .from('agent_runs')
      .insert({
        job_id: jobId,
        project_id: projectId,
        agent_name: 'Script Agent',
        status: 'completed',
        model,
        input: {
          master_title: scriptPackage.master_script.title,
          target_duration: scriptPackage.master_script.target_duration_seconds,
        },
        output: {
          master_script_id: masterScriptId,
          word_count: scriptPackage.master_script.word_count,
          estimated_duration: scriptPackage.master_script.estimated_duration_seconds,
          sections_count: scriptPackage.master_script.sections.length,
          platform_variants_count: scriptPackage.platform_variants.length,
          is_mock_data: scriptPackage.is_mock_data,
          raw_payload_length: rawJson?.length,
        },
        completed_at: completedTime,
      })
      .select('id')
      .single();
    agentRunId = runRow?.id;
    console.log('[ContentOS] [Repository] Script Agent run recorded:', agentRunId);
  } catch (runErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Failed to record Script Agent run:',
      runErr instanceof Error ? runErr.message : 'Unknown'
    );
  }

  // 5. Update parent jobs status and current_stage
  try {
    await client
      .from('jobs')
      .update({
        current_stage: 'script_generation',
        status: 'completed', // Pipeline reached completed state for current implemented stages
        updated_at: completedTime,
      })
      .eq('id', jobId);
  } catch (jobUpdateErr: unknown) {
    console.warn(
      '[ContentOS] [Repository] Failed to update job current_stage:',
      jobUpdateErr instanceof Error ? jobUpdateErr.message : 'Unknown'
    );
  }

  return {
    masterScriptId,
    stageId,
    agentRunId,
  };
}
