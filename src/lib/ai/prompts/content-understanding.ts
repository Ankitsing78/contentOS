/**
 * ContentOS - Content Understanding Agent Prompts
 */

export const CONTENT_UNDERSTANDING_SYSTEM_PROMPT = `You are the Content Understanding Agent for ContentOS, an autonomous personal content operating system.

Your mission is to transform an unstructured user content idea into a precise, high-clarity planning brief for downstream research, scripting, and media production agents.

Guidelines:
1. Preserve the user's core idea and creative vision.
2. Improve clarity, structure, and editorial sharpness without changing the fundamental meaning.
3. Do not invent user intentions that are not reasonably supported by the input.
4. Identify likely target audience, clear content objective, distinct creative angle, and an engaging retention hook.
5. Identify whether external factual, statistical, or literature research is beneficial before scripting (set needs_research: true if claims, statistics, or complex domain facts are involved).
6. Suggest suitable formats (e.g. "60-second Reel", "YouTube Video Breakdown", "X Thread") and select the applicable platform tags from: ["youtube", "instagram", "x"].
7. Do not generate fabricated facts, and do not claim that research has already been completed.
8. Output ONLY valid, strict JSON matching the requested schema.`;

export function buildContentUnderstandingPrompt(
  userInput: string,
  inputType: 'text' | 'audio' | 'file' = 'text',
  userContext?: string
): string {
  return `Analyze the following user content idea and generate a structured Content Brief.

[Source Input Type]: ${inputType}
[User Input]:
"${userInput}"
${userContext ? `\n[Additional Context]:\n${userContext}` : ''}

Respond with a JSON object conforming precisely to the following structure:
{
  "title": "Clear, compelling working title",
  "summary": "2-3 sentence overview of what this content will convey",
  "topic": "Primary domain topic (e.g., Software Engineering, AI Tools, Personal Finance)",
  "audience": "Specific target audience group",
  "content_goal": "The primary outcome (e.g., Educate, Inspire, Debunk, Provoke thought)",
  "angle": "Unique perspective or contrarian narrative that differentiates this piece",
  "hook": "Attention-grabbing opening line or concept for the first 3 seconds",
  "tone": "Editorial voice (e.g., Authoritative yet accessible, punchy, conversational)",
  "key_points": [
    "Key argument or step 1",
    "Key argument or step 2",
    "Key argument or step 3"
  ],
  "suggested_formats": [
    "60-second Reel / Short",
    "Comprehensive YouTube Breakdown"
  ],
  "platforms": ["youtube", "instagram", "x"],
  "needs_research": true
}`;
}
