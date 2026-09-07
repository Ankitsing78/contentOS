# ContentOS 🚀

**ContentOS** is a personal AI-powered autonomous content operating system. It transforms raw thoughts (via text or audio) into platform-optimized content for YouTube, Instagram, and X (Twitter), while maintaining human oversight through an interactive dashboard.

---

## 🎯 Current Development Stage 8B-1: Real Voice / Narration Generation (Completed)

- [x] **Stage 1**: Initialized Next.js 16 (App Router) with React 19, TypeScript, and Tailwind CSS v4.
- [x] **Stage 2**: Built operator-focused ContentOS Command Center UI with responsive layout, operations, pipeline, and agent status monitors.
- [x] **Stage 3**: Persistent database schema (10 tables), Row Level Security (RLS) policies, multi-tier client architecture (Browser, Server, Admin), repository layer, and storage abstraction (`content-assets`).
- [x] **Stage 4**: Integrated official `@google/genai` SDK, Content Understanding Agent with strict Zod validation, end-to-end execution pipeline (`POST /api/content`), and interactive `ContentBriefPanel`.
- [x] **Stage 5**: Implemented provider-agnostic Research Agent architecture, `0002_research_tables.sql` normalized schema, strict Zod schemas, and `DevelopmentMockResearchProvider`.
- [x] **Stage 6A**: Integrated official `@tavily/core` SDK via `TavilyResearchProvider` behind `IResearchProvider`, two-stage bounded search & extraction, prompt-injection-defended Gemini evidence synthesis, and live Supabase persistence.
- [x] **Stage 7**: Built Script Agent with structured Master Script and Platform Variants (`youtube`, `instagram`, `x`), deterministic 150 WPM timing engine, citation validation against real Tavily research, `0003_script_tables.sql`, dual Supabase persistence, and interactive `ScriptPackagePanel`.
- [x] **Stage 8A**: Built Production / Media Planning Agent with normalized scene timelines, visual asset requirements, audio asset requirements, synchronized caption cards, and `0004_production_tables.sql`.
- [x] **Stage 8B-1**: Implemented Real Voice / Narration Generation with `IVoiceProvider`, `GeminiVoiceProvider` (`gemini-3.1-flash-tts-preview`), L16 PCM -> WAV header encapsulation, private Supabase Storage (`content-assets`), `content_assets` persistence, duration tolerance validation, and idempotent execution.
- [x] **Stage 8B-2**: Real Visual Generation via `IImageProvider` and `GeminiImageProvider` (`gemini-3.1-flash-image`), binary header dimension parsing, private storage upload, and requirements linking.
- [x] **Stage 8B-2A**: Added `LocalImageProvider` for local open-source image generation without per-image API charges (ComfyUI / WebUI / Ollama / LocalAI compatible) and provider selection (`IMAGE_PROVIDER="gemini" | "local" | "mock"`).
- [ ] *Stage 8C (Upcoming): Video composition & rendering.*
- [ ] *Stage 9 (Upcoming): Official OAuth integrations & publishing (YouTube, Instagram, X).*

> **Note**: Voice generation is implemented; image/video generation and media assembly are not yet implemented.

---

## 🏗️ Architecture Overview

```
supabase/
└── migrations/
    └── 0001_initial_schema.sql         # Production PostgreSQL schema (10 tables) with RLS

src/
├── app/                                # Next.js App Router
│   ├── api/system/status/route.ts      # Safe backend health & Supabase configuration probe
│   ├── globals.css                     # Dark command center theme
│   ├── layout.tsx                      # Root shell & metadata
│   └── page.tsx                        # ContentOS Command Center
├── components/                         # Modular UI presentation layer
│   ├── command/                        # CommandCenter & QuickActions
│   ├── operations/                     # ActiveOperations & OperationCard
│   ├── pipeline/                       # ContentPipeline & PipelineStage
│   ├── agents/                         # AgentStatus & AgentStatusCard
│   ├── platforms/                      # PlatformStatus
│   ├── content/                        # RecentContent
│   ├── layout/                         # AppShell, Sidebar, Header
│   └── ui/                             # Zero-dependency SVG Icons
├── lib/
│   ├── database/                       # Multi-tier Supabase data layer
│   │   ├── client.ts                   # Browser Supabase client (Anon key, singleton)
│   │   ├── server.ts                   # Standard Server Supabase client
│   │   ├── admin.ts                    # Server-only Admin client (Service Role Key, guarded)
│   │   ├── repositories/               # Typed query repositories
│   │   │   ├── content-projects.ts     # Content project & idea queries
│   │   │   ├── jobs.ts                 # Multi-stage jobs & idempotent stage retries
│   │   │   ├── assets.ts               # Content media asset records
│   │   │   └── platforms.ts            # Connected platforms & published post records
│   │   └── index.ts
│   ├── storage/                        # Storage abstraction layer
│   │   ├── provider.ts                 # IStorageProvider contract & path builder
│   │   ├── supabase-storage.ts         # SupabaseStorageProvider with signed URLs
│   │   └── index.ts
│   ├── ai/                             # Modular AI provider interface (IAIProvider)
│   └── mock/                           # Centralized UI mock data
└── types/                              # Strict TypeScript domain & database types
    ├── database.ts                     # Database table rows, inserts, updates
    ├── content.ts                      # Core content models
    ├── job.ts                          # Background job states & stages
    ├── platform.ts                     # Social platform interfaces
    └── dashboard.ts                    # UI presentation models
```

---

## 🔎 Real Tavily Web Research Architecture (Stage 6A)

```
[CONTENT BRIEF]
      ↓
[PHASE A: Research Planning via Gemini]
  - Formulates 2-3 focused research questions, claims to verify, and freshness window
  - Produces a Zod-validated ResearchPlan
      ↓
[PHASE B: Evidence Collection via IResearchProvider]
  - Provider selection: RESEARCH_PROVIDER="tavily" (or "mock")
  - TavilyResearchProvider executes two-stage retrieval:
      1. Bounded Search: Generates high-precision queries from ResearchPlan; retrieves ranked search results
      2. Selective Extraction: Calls Tavily Extract on top 2-3 quality URLs
      3. Quality Classification: Deterministic domain heuristics for source_type and credibility
      4. Prompt Injection Defense: Delimits untrusted web documents with strict passive data boundaries
      5. Gemini Synthesis: Verifies claims with verbatim quotes, detects source conflicts, moves gaps to unresolved_questions
      ↓
[STRUCTURED RESEARCH PACKAGE]
  - Validated by Zod ResearchPackageSchema (isMockData: false for Tavily)
  - Contains: plan, sources (real URLs, publishers, dates), evidence, unresolved_questions, overall_confidence
      ↓
[SUPABASE PERSISTENCE]
  - Updates jobs current_stage to 'script_generation'
  - Records research stage in job_stages
  - Records execution in agent_runs
  - Persists real web citations to research_plans, research_sources, and research_evidence
```

### Tavily Configuration & Credit Controls

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `TAVILY_API_KEY` | Secret | *Required* | Server-only API key for live web search and extraction |
| `RESEARCH_PROVIDER` | String | `tavily` | Provider selector (`tavily` or `mock`). Throws if `tavily` is set without key |
| `RESEARCH_MAX_QUESTIONS` | Number | `3` | Maximum high-priority research questions to search per brief |
| `RESEARCH_MAX_SEARCHES_PER_QUESTION` | Number | `1` | Maximum search queries per question |
| `RESEARCH_MAX_EXTRACT_SOURCES` | Number | `3` | Maximum candidate URLs to extract full page text from |
| `RESEARCH_SEARCH_DEPTH` | String | `basic` | `basic` (1 credit per query) or `advanced` (2 credits) |

### Security & Prompt Injection Defense

1. **Server-Only Credentials**: `TAVILY_API_KEY` is guarded with Next.js `server-only` and is never exposed to client bundles or logged.
2. **Untrusted Data Boundaries**: Retrieved web documents are enclosed within strict `<untrusted_retrieved_web_document>` boundaries, with system instructions explicitly prohibiting execution of prompt injections found in web text.
3. **Citation Integrity**: Gemini synthesis is strictly constrained to only cite URLs that exist in the retrieved document set; hallucinated URLs are automatically dropped by the sanitizer.

---

## 🗄️ Database Schema & Storage Setup

### Database Tables (`supabase/migrations/0001_initial_schema.sql`)

| Table | Purpose | Cascading / Security Rule |
| :--- | :--- | :--- |
| `content_projects` | Top-level content project records | Cascades to child ideas/scripts/assets |
| `content_ideas` | Initial raw thought & enriched angles | Owned by user via `auth.uid()` |
| `content_scripts` | Platform-specific scripts with versioning | Unique per `(project_id, platform, version)` |
| `content_assets` | Media files in storage (`audio`, `video`, `image`, etc.) | Private storage path references |
| `jobs` | End-to-end orchestration pipelines | Tracks current stage, attempts, error log |
| `job_stages` | Discrete stage checkpoints | Enables retrying failed stages idempotently |
| `agent_runs` | Execution history for micro-agents | Preserved for auditing and analysis |
| `platform_accounts` | Connected YouTube, Instagram, X channels | **Tokens protected**: Never returned to browser |
| `platform_posts` | Historical published post records | Non-destructive `ON DELETE SET NULL` |
| `analytics_snapshots` | Engagement snapshots over time | Cascades from `platform_posts` |

### Row Level Security (RLS)

All 10 tables have Row Level Security enabled. By default, users can only select, insert, update, or delete records where `auth.uid() = user_id` (or through project ownership). Sensitive OAuth tokens in `platform_accounts` (`access_token`, `refresh_token`) are strictly isolated from client-side queries and accessible only by privileged server-side operations.

### Storage Structure

The `IStorageProvider` contract enforces private bucket storage with signed URLs:
```
content-assets/
└── {userId}/
    └── {projectId}/
        ├── audio/
        ├── images/
        ├── video/
        ├── thumbnails/
        ├── subtitles/
        └── documents/
```

---

## ⚙️ Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Required variables for Supabase:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"
```

> [!WARNING]
> Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. The admin client is protected with `import 'server-only'` to guarantee it cannot be bundled into client-side code.

---

## 🚀 Applying Database Migrations

### Option 1: Supabase CLI (Recommended)

```bash
# Link your remote Supabase project
npx supabase link --project-ref your-project-ref

# Push the migration
npx supabase db push
```

### Option 2: Supabase Dashboard SQL Editor

1. Open your Supabase Project Dashboard.
2. Navigate to the **SQL Editor**.
3. Copy the contents of `supabase/migrations/0001_initial_schema.sql`.
4. Click **Run**.

### Option 3: Storage Bucket Setup

1. In the Supabase Dashboard, go to **Storage**.
2. Click **New Bucket**.
3. Name: `content-assets`.
4. Leave **Public bucket** **OFF** (Private bucket for signed URL access).
5. Click **Create bucket**.

---

## 🧠 AI Brain & Content Understanding Agent

### Gemini Configuration

Set your Gemini API key in `.env.local`:

```ini
GEMINI_API_KEY="AIzaSy..."
# Optional override for model (defaults to gemini-3.6-flash):
GEMINI_MODEL="gemini-3.6-flash"
```

> [!NOTE]
> `GEMINI_API_KEY` is strictly server-only and never exposed to the client. If `GEMINI_API_KEY` is not configured, the Command Center returns a clear configuration notice without fabricating fake AI data.

### How the Content Understanding Agent Works

1. **Intake**: Receives raw user thoughts (via text or audio dictation).
2. **Analysis**: Evaluates narrative clarity, primary domain topic, target audience, angle, and retention hook using Google Gemini (`@google/genai`).
3. **Strict Validation**: Validates the model output against the Zod `ContentBriefSchema` before any database persistence.
4. **Persistence**:
   - Creates a `content_projects` record.
   - Creates initial `content_ideas`.
   - Initializes a multi-stage `jobs` pipeline with an `ideation` stage in `job_stages`.
   - Logs execution details and model metadata in `agent_runs`.
5. **Presentation**: Delivers a rich, structured `ContentBriefPanel` directly to the Command Center UI.

### API Specification: `POST /api/content`

**Request**:
```json
{
  "input": "Create a 60 second reel explaining why AI won't replace good developers.",
  "inputType": "text"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "projectId": "...",
  "jobId": "...",
  "brief": {
    "title": "Why AI Makes Good Developers Indispensable",
    "summary": "Explains why AI code generators augment rather than replace senior problem-solvers...",
    "topic": "Software Engineering & AI",
    "audience": "Software developers and engineering leaders",
    "content_goal": "Reassure and educate developers on real-world AI augmentation",
    "angle": "AI replaces syntax typing, but multiplies the value of architectural judgment",
    "hook": "AI isn't coming for your job — it's coming for boilerplate.",
    "tone": "Authoritative, technical, punchy",
    "key_points": [
      "AI predicts likely tokens; engineers architect resilient systems",
      "Debugging generated code requires deeper understanding, not less",
      "The competitive advantage shifts from typing speed to problem framing"
    ],
    "suggested_formats": ["60-second Reel", "YouTube Short", "X Thread"],
    "platforms": ["instagram", "youtube", "x"],
    "needs_research": true
  },
  "originalInput": "Create a 60 second reel explaining why AI won't replace good developers.",
  "createdAt": "2026-09-07T..."
}
```

---

## 🔎 Research Agent & Provider Abstraction (Step 5)

When a `ContentBrief` specifies `needs_research: true`, the autonomous pipeline engages the **Research Agent**.

### Two-Phase Research Lifecycle

```
CONTENT BRIEF
     ↓
[PHASE A: Research Planning]
  - Driven by Google Gemini
  - Evaluates factual claims & statistics in the brief
  - Establishes core research questions, claims to verify, and source/freshness rules
  - Strictly prohibited from inventing citations or assuming claims are true
  - Produces a Zod-validated ResearchPlan
     ↓
[PHASE B: Evidence Collection]
  - Orchestrated via provider-agnostic IResearchProvider interface
  - Future providers: Tavily, SerpAPI, Google Search, Internal Vector Stores
  - Currently exercises DevelopmentMockResearchProvider (explicitly stamped test fixtures; no fake URLs)
     ↓
[STRUCTURED RESEARCH PACKAGE]
  - Validated by Zod ResearchPackageSchema
  - Contains: plan, sources, evidence, unresolved_questions, overall_confidence
     ↓
[SUPABASE PERSISTENCE]
  - Updates jobs stage to 'research' (and advances to 'script_generation')
  - Updates job_stages with output payload
  - Records execution in agent_runs
  - Persists normalized data to research_plans, research_sources, and research_evidence
```

### Research Database Migration

To install the normalized research tables:
1. Open Supabase Dashboard -> **SQL Editor**.
2. Run `supabase/migrations/0002_research_tables.sql`.

### API Specification: `POST /api/content/:projectId/research`

**Request**:
```bash
curl -X POST http://localhost:3000/api/content/{projectId}/research
```

**Response (200 OK)**:
```json
{
  "success": true,
  "projectId": "87c7b326-377e-4df0-8ce3-6287233fed32",
  "jobId": "e94adf1b-f7fb-406c-a5de-2fe9304814ba",
  "researchPackage": {
    "plan": {
      "research_questions": [
        "What specific software engineering tasks are currently automated by LLMs vs remaining human-dependent?",
        "What do developer productivity benchmarks show regarding code quality and debugging overhead?"
      ],
      "claims_to_verify": [
        "AI handles syntax and boilerplate, but struggles with system design and business context"
      ],
      "facts_needed": [
        "Empirical statistics on software engineering time spent on architecture vs typing syntax"
      ],
      "source_requirements": [
        "Primary industry reports (e.g. GitHub Octoverse, Stack Overflow)",
        "Academic software engineering benchmarks"
      ],
      "freshness_requirements": "Within the last 12 months",
      "research_priority": "high"
    },
    "sources": [...],
    "evidence": [...],
    "unresolved_questions": [...],
    "overall_confidence": "medium",
    "isMockData": true
  },
  "skipped": false,
  "createdAt": "2026-09-07T..."
}
```

---

## 🎙️ Real Voice / Narration Generation Architecture (Stage 8B-1)

```
[APPROVED PRODUCTION PACKAGE]
       ↓
[PRODUCTION AUDIO REQUIREMENT] (audio_type: 'voiceover', status: 'pending', generation_required: true)
       ↓
[IVoiceProvider ABSTRACTION]
       ↓
[GeminiVoiceProvider]
  - Model: gemini-3.1-flash-tts-preview
  - Uses @google/genai with server-only GEMINI_API_KEY
  - Prompts model with authoritative script text verbatim (zero commentary/intros/outros)
  - Receives high-fidelity 24kHz linear PCM audio (audio/l16)
       ↓
[PCM to WAV PACKAGING & DURATION ANALYSIS]
  - Encapsulates linear PCM in standard 44-byte RIFF/WAVE header (zero FFmpeg dependency)
  - Inspects header to calculate exact duration in seconds
  - Compares against planned duration (enforces tolerance threshold)
       ↓
[PRIVATE SUPABASE STORAGE]
  - Bucket: content-assets (private)
  - Path: projects/{projectId}/audio/narration/{assetId}.wav
       ↓
[DATABASE PERSISTENCE & AUDIT LINKING]
  - Inserts row in public.content_assets (asset_type: 'audio', mime_type: 'audio/wav', metadata)
  - Updates production_audio_requirements: status = 'completed', storage_path, content_asset_id
  - Records execution in agent_runs ('Voice Generation Agent')
  - Records stage completion in job_stages ('voice_generation' / 'audio_generation')
  - Keeps job at media-generation frontier (visuals and BGM remain pending)
```

### Voice Database Migration

To install the voice asset foreign key and update check constraints:
1. Open Supabase Dashboard -> **SQL Editor**.
2. Run `supabase/migrations/0005_voice_assets.sql`.

### API Specification: `POST /api/content/:projectId/production/voice`

**Request**:
```bash
curl -X POST http://localhost:3000/api/content/{projectId}/production/voice \
  -H "Content-Type: application/json" \
  -d '{"requirementId": "b43ba6ea-1e0d-4b27-81e7-fb9275a4696c"}'
```

**Response (200 OK)**:
```json
{
  "success": true,
  "projectId": "87c7b326-377e-4df0-8ce3-6287233fed32",
  "jobId": "e94adf1b-f7fb-406c-a5de-2fe9304814ba",
  "requirementId": "b43ba6ea-1e0d-4b27-81e7-fb9275a4696c",
  "isReused": false,
  "assetId": "dc89153e-e3a4-4d42-83e1-11cdd88e8122",
  "storagePath": "projects/87c7b326-377e-4df0-8ce3-6287233fed32/audio/narration/2d4c9cfb-f4d9-41f1-bb9c-c28a1fc11c25.wav",
  "audioMetadata": {
    "mimeType": "audio/wav",
    "fileExtension": "wav",
    "durationSeconds": 4.48,
    "plannedDurationSeconds": 6.9,
    "durationDeviationSeconds": 2.42,
    "fileSizeBytes": 215084,
    "provider": "gemini",
    "model": "gemini-3.1-flash-tts-preview"
  },
  "audioRequirement": {
    "id": "b43ba6ea-1e0d-4b27-81e7-fb9275a4696c",
    "status": "completed",
    "storage_path": "projects/87c7b326-377e-4df0-8ce3-6287233fed32/audio/narration/2d4c9cfb-f4d9-41f1-bb9c-c28a1fc11c25.wav"
  }
}
```

---

## 🎨 Stage 8B-2A: Real Visual / Image Generation

Stage 8B-2A implements the first real visual-generation capability in ContentOS: turning structured production visual requirements (`production_visual_requirements`) into real graphic assets using Google's `gemini-3.1-flash-image` model through a vendor-agnostic `IImageProvider` abstraction, storing the resulting image in the private `content-assets` Supabase Storage bucket, recording asset metadata in `content_assets`, and updating pipeline tracking.

> [!NOTE]
> **Implementation Scope**: Image generation is implemented for one controlled production asset. Video generation and media assembly are not yet implemented.

### Visual Architecture & Flow

```
[PRODUCTION VISUAL REQUIREMENT]
  - Scene prompt: Visual description & style guidelines
  - Aspect ratio: 9:16 (Instagram Reels / Shorts) or 16:9
       ↓
[IImageProvider ABSTRACTION]
  - Implementation: GeminiImageProvider (Server-only)
  - SDK: @google/genai with process.env.GEMINI_API_KEY
  - Model: gemini-3.1-flash-image
  - Modality: responseModalities: ['IMAGE']
       ↓
[ZERO-DEPENDENCY IMAGE PARSER]
  - Inspects binary headers for PNG, JPEG, and WebP
  - Validates width, height, and confirmed MIME type
  - Verifies aspect ratio alignment
       ↓
[PRIVATE SUPABASE STORAGE]
  - Bucket: content-assets (private)
  - Path: projects/{projectId}/visuals/{assetId}.{ext}
       ↓
[DATABASE PERSISTENCE & AUDIT LINKING]
  - Inserts row in public.content_assets (asset_type: 'image', metadata)
  - Updates production_visual_requirements: status = 'completed', storage_path, content_asset_id
  - Records execution in agent_runs ('Image Generation Agent')
  - Records stage completion in job_stages ('visual_generation')
  - Keeps other visual requirements and audio requirements in current states
```

### Visual Database Migration

To install the visual asset foreign key and stage constraint:
### Step 8B-2: Real Visual & Graphic Generation

ContentOS generates verified production-ready visual assets (background graphics, diagram layouts, and UI mockups) using Google's `gemini-3.1-flash-image` model through a modular, vendor-neutral `IImageProvider` abstraction.

1. **Provider Abstraction**: Decouples visual generation from specific AI vendors via `IImageProvider` (`src/lib/media/image-provider.ts`).
2. **Current Model**: Uses `gemini-3.1-flash-image` via `@google/genai` server-side SDK.
3. **Format & Framing**: Native support for 9:16 vertical video framing (1080x1920), 16:9, 1:1, and 4:5 aspect ratios with zero-dependency binary header validation (`src/lib/media/image-parser.ts`).
4. **Private Storage**: Assets are stored in the private `content-assets` bucket under `projects/{projectId}/visuals/{sceneId}/{assetId}.png`.
5. **Secure Previews**: Previews are served via short-lived signed URLs from `GET /api/content/:projectId/production/visuals/:visualRequirementId/preview`. The storage bucket is never exposed publicly.
6. **Strict Idempotency**: If a visual requirement has already completed generation, repeated calls reuse the existing asset without calling Gemini or creating duplicate database rows.
7. **One-at-a-time Generation**: Controlled, scene-by-scene asset generation allows granular review and saves quota.
8. **Prompt Injection Defense**: Sanitizes user and research text against prompt injection while preserving factual grounding from the research phase.

### API Specification: `POST /api/content/:projectId/production/visuals/:visualRequirementId/generate`

**Request**:
```bash
curl -X POST http://localhost:3000/api/content/{projectId}/production/visuals/{visualRequirementId}/generate \
  -H "Content-Type: application/json"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "isReused": false,
  "asset": {
    "id": "uuid",
    "project_id": "87c7b326-377e-4df0-8ce3-6287233fed32",
    "asset_type": "image",
    "storage_path": "projects/{projectId}/visuals/{sceneId}/{assetId}.png",
    "mime_type": "image/png",
    "file_size": 1024,
    "width": 1080,
    "height": 1920,
    "aspect_ratio": "9:16",
    "model": "gemini-3.1-flash-image",
    "provider": "gemini"
  },
  "requirement": {
    "id": "visualRequirementId",
    "status": "completed",
    "storage_path": "projects/{projectId}/visuals/{sceneId}/{assetId}.png",
    "content_asset_id": "uuid",
    "generation_required": false
  },
  "agentRunId": "uuid",
  "jobStageId": "uuid"
}
```

---

## 🎨 Local Image Provider (Stage 8B-2A)

ContentOS supports open-source local image inference servers (e.g. ComfyUI, Ollama, Stable Diffusion WebUI/Forge, LocalAI, or custom inference wrappers) with zero per-image API fees.

### Configuration

Set your environment variables in `.env.local`:

```ini
# Image Provider Selection: "gemini" | "local" | "mock"
IMAGE_PROVIDER="local"

# Local Inference Server URL
LOCAL_IMAGE_API_URL="http://127.0.0.1:8188"

# Model identifier
LOCAL_IMAGE_MODEL="sdxl"

# Optional Authorization Token (if local proxy requires auth)
LOCAL_IMAGE_API_KEY=""

# Timeout in milliseconds (default: 60000)
LOCAL_IMAGE_TIMEOUT_MS="60000"
```

### Strict Provider Policy

- **No Silent Fallbacks**: If `IMAGE_PROVIDER="local"` is configured and the local inference server is unavailable, ContentOS fails explicitly with `LocalImageProviderError` (`UNAVAILABLE`) rather than silently routing to a paid cloud provider or test mock.
- **Protocol Flexibility**: Supports both standard OpenAI-compatible image endpoints (`{ data: [{ b64_json }] }`), ComfyUI wrappers, and direct binary stream responses (`image/png`, `image/jpeg`).
- **Binary Validation**: All generated images are validated using magic byte headers and dimension thresholds before storage upload.

---

## 🧪 Verification & Development

```bash
# Run visual agent unit tests (mocked image provider)
npm run test:image

# Run voice agent unit tests (mocked Gemini TTS)
npm run test:voice

# Run production planning unit tests
npm run test:production

# Run script agent unit tests
npm run test:script

# Run research agent unit tests
npm run test:research

# Check code style & lints
npm run lint

# Compile and check TypeScript types
npm run build

# Start local development server
npm run dev

# Safe Server Status Endpoint (Tests Supabase connection without leaking secrets)
curl http://localhost:3000/api/system/status
```
