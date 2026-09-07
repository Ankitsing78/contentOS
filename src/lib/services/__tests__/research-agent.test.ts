/**
 * ContentOS - Research Agent & Schema Unit Verification Suite
 */

import {
  ResearchPlanSchema,
  ResearchPackageSchema,
} from '../../ai/schema/research';
import { DevelopmentMockResearchProvider } from '../../research/mock-provider';
import { ResearchAgent } from '../research-agent';
import { ContentBrief } from '@/types';
import { IAIProvider } from '../../ai/provider';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}`);
      failed++;
    }
  }

  console.log('\n=============================================');
  console.log('  ContentOS Research Agent & Schema Test Suite');
  console.log('=============================================\n');

  // 1. ResearchPlanSchema Validation Tests
  console.log('--- 1. Schema Validation Tests ---');
  const validPlan = {
    research_questions: [
      'What are the primary performance trade-offs of Next.js Turbopack?',
      'How does developer velocity compare between manual and AI-assisted workflows?',
    ],
    claims_to_verify: ['Developers report 30% reduction in boilerplate syntax typing'],
    facts_needed: ['2025 StackOverflow developer survey statistics'],
    source_requirements: ['Official Next.js documentation', 'Peer-reviewed studies'],
    freshness_requirements: 'Within the last 12 months',
    research_priority: 'medium' as const,
  };

  const validPlanResult = ResearchPlanSchema.safeParse(validPlan);
  assert(validPlanResult.success, 'Valid ResearchPlan passes validation');

  // Malformed Plan: missing research_questions
  const malformedPlan1 = {
    research_questions: [], // Invalid: min 1 required
    freshness_requirements: 'Within 6 months',
    research_priority: 'high',
  };
  const malformedResult1 = ResearchPlanSchema.safeParse(malformedPlan1);
  assert(!malformedResult1.success, 'Empty research_questions is rejected');

  // Malformed Plan: invalid priority
  const malformedPlan2 = {
    research_questions: ['Valid research question here?'],
    freshness_requirements: 'Within 6 months',
    research_priority: 'critical', // Invalid: not in 'low' | 'medium' | 'high'
  };
  const malformedResult2 = ResearchPlanSchema.safeParse(malformedPlan2);
  assert(!malformedResult2.success, 'Invalid research_priority is rejected');

  // 2. DevelopmentMockResearchProvider Behavior
  console.log('\n--- 2. Mock Research Provider Tests ---');
  const mockProvider = new DevelopmentMockResearchProvider();
  assert(mockProvider.isMock === true, 'Mock provider is explicitly flagged isMock = true');

  const retrievalResult = await mockProvider.gatherEvidence(validPlan);
  assert(retrievalResult.isMockData === true, 'Retrieval result is explicitly flagged isMockData = true');
  assert(retrievalResult.sources.length === 1, 'Mock provider returns labeled test fixture');
  assert(
    retrievalResult.sources[0].source_type === 'mock_test_fixture',
    'Source type is strictly "mock_test_fixture"'
  );
  assert(
    retrievalResult.sources[0].url === '',
    'Mock provider strictly never fabricates external URLs'
  );

  // 3. ResearchPackageSchema Validation
  console.log('\n--- 3. Research Package Schema Tests ---');
  const packageData = {
    plan: validPlan,
    sources: retrievalResult.sources,
    evidence: retrievalResult.evidence,
    unresolved_questions: retrievalResult.unresolved_questions,
    overall_confidence: retrievalResult.overall_confidence,
    isMockData: retrievalResult.isMockData,
  };

  const packageResult = ResearchPackageSchema.safeParse(packageData);
  assert(packageResult.success, 'Assembled ResearchPackage passes validation');

  // 4. ResearchAgent with needs_research === false
  console.log('\n--- 4. Research Agent Skipping Logic ---');
  const briefWithoutResearch: ContentBrief = {
    title: 'Short Creative Punchline',
    summary: 'A simple non-factual joke/creative hook',
    topic: 'Creative Writing',
    audience: 'General',
    content_goal: 'Entertainment',
    angle: 'Humorous',
    hook: 'Why did the developer cross the road?',
    tone: 'Playful',
    key_points: ['Just a punchline'],
    suggested_formats: ['Tweet'],
    platforms: ['x'],
    needs_research: false,
  };

  // Mock AI provider that should NOT be called when needs_research is false
  let aiCalled = false;
  const mockAIProvider: IAIProvider = {
    id: 'gemini',
    async generateText() {
      aiCalled = true;
      return { text: '' };
    },
    async generateStructured<T>() {
      aiCalled = true;
      return { data: {} as T, raw: '{}' };
    },
  };

  const agent = new ResearchAgent(mockAIProvider, mockProvider);
  const skipResult = await agent.execute({ brief: briefWithoutResearch });

  assert(skipResult.skipped === true, 'Agent correctly sets skipped = true when needs_research is false');
  assert(aiCalled === false, 'AI was not invoked when needs_research is false (no fabrication)');
  assert(
    skipResult.package.overall_confidence === 'high',
    'Confidence is high for skipped research'
  );

  // 5. ResearchAgent with needs_research === true
  console.log('\n--- 5. Research Agent Planning Flow ---');
  const mockAIWithPlan: IAIProvider = {
    id: 'gemini',
    async generateText() {
      return { text: '' };
    },
    async generateStructured<T>() {
      return {
        data: validPlan as unknown as T,
        raw: JSON.stringify(validPlan),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };
    },
  };

  const activeBrief: ContentBrief = {
    ...briefWithoutResearch,
    needs_research: true,
  };

  const agentActive = new ResearchAgent(mockAIWithPlan, mockProvider);
  const activeResult = await agentActive.execute({ brief: activeBrief });

  assert(activeResult.skipped === false, 'Agent marks skipped = false when research is needed');
  assert(activeResult.package.plan.research_questions.length === 2, 'Agent populates plan questions');
  assert(activeResult.package.isMockData === true, 'Agent correctly stamps mock retrieval');

  console.log('\n=============================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
