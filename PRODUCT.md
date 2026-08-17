# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two-sided product, both sides co-primary:

- **Assessors** — recruiters and talent teams at client companies (tenants) hiring through Rakamin's platform. They define vacancies and skill-based assessments, invite candidates, monitor live interview sessions, review AI-generated candidate portfolios, override AI skill levels with notes, and read fit-gap reports against vacancies.
- **Candidates** — job applicants who open an invite link, pass a hardware readiness check, and are interviewed live by an AI voice agent. Interviews run in English or Indonesian, within a per-assessment time limit.

## Product Purpose

The AI Interview Platform lets client companies replace or augment human screening interviews with fully AI-conducted live voice interviews. An AI interviewer converses with the candidate in real time over streaming audio, probes the candidate's skills against a configured taxonomy (L1–L5 anchors with include/exclude scopes), and produces a candidate portfolio: per-skill AI level with confidence, quoted evidence, and a competency summary. Assessors review and may override AI levels, and the platform generates fit-gap reports comparing a candidate's portfolio against a vacancy's required levels (match / gap / exceed / not assessed) with culture and overall narratives. Success means a client can make a confident screening decision from evidence-grounded AI assessment without a human conducting the interview.

## Positioning

Fully AI-conducted live voice interviews with automatic, evidence-based skill scoring. The AI interviewer (Gemini Live API) drives the conversation in real time over a WebSocket audio stream, probes skills against anchor levels, and scores the candidate on L1–L5 with evidence quoted from the transcript. The combination in one flow — live conversational interviewing, per-skill evidence-linked scoring, and vacancy fit-gap reporting — is the mechanism a neighboring product could not truthfully copy.

## Operating Context

- Runs as a white-label / B2B module of Rakamin's hiring platform: JWT auth secret is shared with `rakamin-api`, and the app is multi-tenant (each client company is a tenant).
- Web app (React + Vite) talks to a Rails API over REST and WebSocket; real-time audio streams over WebSocket through an audio worklet for PCM processing.
- Candidate flow: invite token URL → hardware check (microphone required; camera optional and configurable; network speed check) → live AI interview → transcript.
- Assessor flow: manage vacancies (role title, culture dimensions, competency expectations, skills with expected levels) and assessments (taxonomy picker plus custom skills, per-skill scope include/exclude and L1–L5 anchors, time limit, language, system prompt); invite candidates per assessment; live-monitor sessions; review portfolios and transcripts; generate fit-gap reports; override AI levels with assessor notes.
- Background jobs (Sidekiq) generate portfolios and fit-gap reports; Redis backs Sidekiq and streaming state.
- Local development: Rails API on `:3001`, Vite dev server on `:5173`; local auth uses a JWT from the Rakamin platform plus tenant context environment variables.

## Capabilities and Constraints

Capabilities:

- Skill taxonomy management, with per-assessment custom skills
- Assessment CRUD: per-skill anchors (L1–L5), scope include/exclude, expected levels, time limit, language (en/id), system prompt
- Vacancy CRUD: role title, culture dimensions, competency expectations, skills with expected levels
- Candidate invites via tokenized URLs
- Hardware readiness check (mic, optional camera, network speed)
- Live AI voice interview over WebSocket using Gemini Live (models configurable: live, analysis, pro)
- Real-time transcript and live session monitoring
- AI portfolio generation per session (per-skill level, confidence, evidence, competency summary)
- Assessor overrides of AI skill levels, with notes
- Fit-gap reports comparing portfolio to vacancy (match / gap / exceed / not assessed)
- Session lifecycle pending → active → ended, with end reasons, audio draining, and reconnect handling

Constraints:

- Auth is shared with `rakamin-api` — the JWT secret must match; the integration is not standalone
- AI capabilities depend on Gemini API keys and models (`GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`, `GEMINI_ANALYSIS_MODEL`, `GEMINI_PRO_MODEL`)
- Candidate browsers must support `getUserMedia` and `AudioWorklet` for the interview
- Interview language is limited to English and Indonesian
- Frontend origins are restricted by a CORS allowlist

## Brand Commitments

- Repository and product name: `rakamin-ai-interview` (platform reference: `ai-interview-platform`).
- Initial product specification is binding at https://github.com/rakamindev/ai-interview-platform/wiki.
- No brand assets, voice guidelines, or identity constraints were found in the repository.

## Evidence on Hand

- Repo docs: root, `api/`, and `web/` READMEs (product spec reference, local setup, tech stack)
- Domain model and route structure: `web/src/types/index.ts`, `web/src/App.tsx`
- Page and component implementations: `web/src/pages/`, `web/src/components/`
- API configuration: `api/config/application.yml` (Gemini models, shared secret), `api/config/database.yml`, `api/k8s/` manifests
- No testimonials, customer names, pricing, or press exist in the repo — future work must not fabricate them.

## Product Principles

1. **Evidence over assertion** — every AI skill score must trace to quoted transcript evidence an assessor can verify.
2. **Conversation, not a form** — the interview is a live voice interaction with real-time probing; it must feel like a real conversation.
3. **Assessor control wins** — humans can override AI levels with notes; AI output is a draft, not a verdict.
4. **Two-sided value** — the product works only when both the assessor workflow and the candidate experience are excellent.
5. **Integration is a commitment** — shared auth with `rakamin-api` and multi-tenancy are architectural facts, not negotiable.
