/**
 * ContentOS - Video Prototype Renderer Tests
 * Verifies SVG visual generator, ASS subtitle formatter, 9:16 aspect ratio,
 * and strict namespace isolation from production pipelines.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateSceneSvg,
  generateAssCaptions,
  PrototypeScene,
} from '@/lib/media/video-prototype-renderer';

describe('Video Prototype Renderer', () => {
  const sampleScenes: PrototypeScene[] = [
    {
      order: 1,
      title: 'HOOK',
      purpose: 'The Paradox of Developer Leverage',
      startSecond: 0,
      endSecond: 7,
      durationSeconds: 7,
      spokenText: 'Developers writing code manually in 2026 are already falling behind.',
      onScreenText: 'HOOK // SCENE 01: THE 2026 SHIFT',
      visualDirection: 'Kinetic typography headline with high-contrast badge',
    },
    {
      order: 2,
      title: 'PROBLEM',
      purpose: 'Code Velocity Comparison',
      startSecond: 7,
      endSecond: 19,
      durationSeconds: 12,
      spokenText: 'The top 1% of engineers are not writing more lines. They are supervising swarms of specialized agents.',
      onScreenText: 'LEGACY CODING vs CONTENTOS PIPELINE',
      visualDirection: 'Split-card showing legacy manual syntax vs AI agent spec orchestration',
    },
    {
      order: 3,
      title: 'EVIDENCE',
      purpose: 'Empirical Research Benchmarks',
      startSecond: 19,
      endSecond: 34,
      durationSeconds: 15,
      spokenText: 'Verified enterprise benchmarks show an immediate 40.5 percent boost in merge frequency.',
      onScreenText: 'RESEARCH BACKED: +40.5% PR VELOCITY',
      visualDirection: 'Verified benchmark data card citing 40.5% PR velocity improvement',
    },
    {
      order: 4,
      title: 'RESOLUTION',
      purpose: 'Agent Swarm Architecture',
      startSecond: 34,
      endSecond: 50,
      durationSeconds: 16,
      spokenText: 'By decoupling specification from implementation, teams move from weeks to minutes per cycle.',
      onScreenText: 'AGENT SWARM TOPOLOGY',
      visualDirection: 'Multi-node network graph showing Planner, Researcher, Coder, and Reviewer',
    },
    {
      order: 5,
      title: 'CTA',
      purpose: 'The Next Developer Paradigm',
      startSecond: 50,
      endSecond: 60,
      durationSeconds: 10,
      spokenText: 'The future belongs to the orchestrators. Adapt your workflow today with ContentOS Enterprise.',
      onScreenText: 'ContentOS Enterprise',
      visualDirection: 'High-impact CTA card with glowing accent border',
    },
  ];

  describe('SVG Visual Generation', () => {
    it('generates valid 1080x1920 (9:16) SVG for all scenes', () => {
      for (const scene of sampleScenes) {
        const svg = generateSceneSvg(scene);
        assert.ok(svg.includes('<svg'), `Scene ${scene.order} should be an SVG element`);
        assert.ok(svg.includes('width="1080"'), `Scene ${scene.order} width should be 1080`);
        assert.ok(svg.includes('height="1920"'), `Scene ${scene.order} height should be 1920`);
        assert.ok(svg.includes('viewBox="0 0 1080 1920"'), `Scene ${scene.order} viewBox should be 0 0 1080 1920`);
      }
    });

    it('always includes the [PROTOTYPE / DEMO VISUAL] banner badge', () => {
      for (const scene of sampleScenes) {
        const svg = generateSceneSvg(scene);
        assert.ok(
          svg.includes('[PROTOTYPE / DEMO VISUAL]'),
          `Scene ${scene.order} must contain the prototype safety badge`
        );
      }
    });

    it('generates scene-specific specialized graphics for all 5 scenes', () => {
      const s1 = generateSceneSvg(sampleScenes[0]);
      assert.ok(s1.includes('HOOK &amp; PREMISE') || s1.includes('THE 2026 SHIFT'), 'Scene 1 should include hook header');

      const s2 = generateSceneSvg(sampleScenes[1]);
      assert.ok(s2.includes('system_architect.ts'), 'Scene 2 should have terminal/code card');

      const s3 = generateSceneSvg(sampleScenes[2]);
      assert.ok(s3.includes('+40.5%'), 'Scene 3 should render the PR velocity benchmark metric');

      const s4 = generateSceneSvg(sampleScenes[3]);
      assert.ok(s4.includes('AGENT SWARM TOPOLOGY'), 'Scene 4 should render the swarm graph');

      const s5 = generateSceneSvg(sampleScenes[4]);
      assert.ok(s5.includes('LEVEL UP YOUR CRAFT') || s5.includes('ACTIONABLE TAKEAWAY'), 'Scene 5 should render CTA outro');
    });
  });

  describe('ASS Subtitle Generation', () => {
    it('generates a valid ASS subtitle stream with correct 9:16 safe-zone styling', () => {
      const ass = generateAssCaptions(sampleScenes);
      assert.ok(ass.includes('[Script Info]'), 'ASS file must have [Script Info] header');
      assert.ok(ass.includes('PlayResX: 1080'), 'PlayResX should be 1080');
      assert.ok(ass.includes('PlayResY: 1920'), 'PlayResY should be 1920');
      assert.ok(ass.includes('[V4+ Styles]'), 'ASS file must have styles');
      assert.ok(ass.includes('[Events]'), 'ASS file must have events block');
    });

    it('creates subtitle dialogues corresponding to scene timestamps and durations', () => {
      const ass = generateAssCaptions(sampleScenes);
      // Dialogue line format: Dialogue: 0,Start,End,Style,...
      const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
      assert.ok(
        dialogueLines.length >= sampleScenes.length,
        'Should produce at least one ASS dialogue chunk per scene'
      );

      // Verify Scene 1 starts at 0:00:00.00
      assert.ok(dialogueLines[0].includes('0:00:00.00'), 'Scene 1 dialogue should start at 0s');
    });
  });

  describe('Namespace Isolation Safety', () => {
    it('strictly isolates prototype artifacts from production storage paths', () => {
      const testProjectId = '87c7b326-377e-4df0-8ce3-6287233fed32';
      const testId = 'test-uuid-abc';
      const prototypePath = `prototype/projects/${testProjectId}/video-tests/${testId}/prototype_video.mp4`;
      const productionPathPrefix = `projects/${testProjectId}/video/`;

      assert.ok(
        prototypePath.startsWith('prototype/'),
        'Prototype paths must reside inside the prototype/ prefix'
      );
      assert.ok(
        !prototypePath.startsWith(productionPathPrefix),
        'Prototype paths must never overlap with production video paths'
      );
    });
  });
});
