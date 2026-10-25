# AI Interview Platform — Monozukuri Product Engineer Revamp

[![CI](https://github.com/ferdianqbl/ai-interview-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/ferdianqbl/ai-interview-platform/actions/workflows/ci.yml)
[![Ruby](https://img.shields.io/badge/Ruby-3.3.2-CC342D.svg)](https://www.ruby-lang.org/)
[![Rails](https://img.shields.io/badge/Rails-7.1-CC0000.svg)](https://rubyonrails.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)

A production-grade, multi-tenant AI talent assessment platform that bridges automated conversational voice interviews, evidence-backed competency synthesis, human assessor calibration, and role-specific Fit/Gap evaluations.

---

## Architecture Overview

The platform is structured as a unified monorepo containing two decoupled services:

```
.
├── api/          # Backend API (Ruby 3.3.2, Rails 7.1, PostgreSQL, Redis / Sidekiq, Gemini AI)
├── web/          # Frontend SPA (React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query)
└── assessment/   # Comprehensive Case Study Deliverables & Monozukuri Execution Reports
```

### Core Product Capabilities
1. **Real-Time Multimodal Voice Interview:** Low-latency WebAudio 16kHz PCM streaming over WebSocket with browser-side Int16 RMS volume reactivity, asynchronous silence detection, and automated Gemini `v1beta` model fallbacks.
2. **Evidence-Backed Skill Portfolio:** Automated competency extraction anchoring every rating (L1–L5) to verbatim candidate quotes with speaker attribution.
3. **Auditable Assessor Calibration (UU PDP Art. 16):** Human assessor score overrides that preserve original AI baselines immutably with mandatory reasoning notes.
4. **Vacancy Fit/Gap Matrix & Narratives:** Deterministic competency delta calculation (`Match`, `Exceeds`, `Gap`, `Not Assessed`) paired with synthesized executive culture narratives and readiness scores.
5. **Strict Multi-Tenant Scoping:** Tenant resolution based strictly on user membership (`Current.tenant_id`), rejecting client spoofing, and purging frontend query caches on account switches.

---

## Quick Start Guide

### 1. Backend Service (`api/`)

```bash
cd api

# 1. Environment configuration
cp config/application.yml.sample config/application.yml

# 2. Install gems
bundle install

# 3. Database setup & multi-tenant seed
bin/rails db:create
bin/rails db:migrate
bin/rails db:seed

# 4. Start Redis (Docker) & Sidekiq (optional for async jobs)
docker run -d -p 6379:6379 --name redis redis:alpine
bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml

# 5. Start Rails API server (Port 3001)
bundle exec rails server
```

### 2. Frontend Service (`web/`)

```bash
cd web

# 1. Environment configuration
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start development server (Port 5173)
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## Demo Accounts & Multi-Tenant Verification

The database is seeded with two completely isolated organizations:

| Organization | Email | Password | Role & Features Seeded |
|---|---|---|---|
| **Test Corp** (`test-corp`) | `admin@example.com` | `password123` | Engineering · 2 Assessments · 2 Vacancies |
| **Acme Corp** (`acme-corp`) | `admin@acme.com` | `password123` | Product Mgmt · 1 Assessment · 2 Vacancies |

> **Pro-Tip:** The login screen includes **1-click Quick-Fill buttons** for instant switching and tenant isolation verification.

---

## Automated Test Harness & Verification

### Backend RSpec Suite (41 Specs, 0 Failures)
```bash
cd api
bundle exec rspec
```

### Frontend Vitest Suite (28 Tests Across 9 Suites, 0 Failures)
```bash
cd web
npm test
```

### Frontend Production Build (0 TypeScript Errors)
```bash
cd web
npm run build
```

### Frontend Playwright E2E Suite (6 Browser Flows, 0 Failures)
```bash
cd web
npx playwright test
```

---

## Case Study Documentation (`/assessment`)

For complete architectural specifications, trade-off matrices, and recruiter review resolutions, see:

- [`assessment/EXECUTION_REPORT.pdf`](assessment/EXECUTION_REPORT.pdf) — Comprehensive single PDF report for hiring committee review.
- [`assessment/EXECUTION_REPORT.md`](assessment/EXECUTION_REPORT.md) — Detailed Markdown execution journey and Step 1–6 checklist.
- [`assessment/PRD.md`](assessment/PRD.md) — Product Requirements Document and UU PDP No. 27/2022 compliance specifications.
- [`assessment/BACKEND_ARCHITECTURE.md`](assessment/BACKEND_ARCHITECTURE.md) — Database schema, tenant isolation, and async worker architecture.
- [`assessment/FRONTEND_ARCHITECTURE.md`](assessment/FRONTEND_ARCHITECTURE.md) — Feature-slice folder hierarchy, TanStack Query cache design, and UI states.
- [`assessment/ASSESSMENT_VALIDATION_MATRIX.md`](assessment/ASSESSMENT_VALIDATION_MATRIX.md) — Complete requirement verification matrix.
- [`assessment/VIDEO_WALKTHROUGH_SCRIPT.md`](assessment/VIDEO_WALKTHROUGH_SCRIPT.md) — Demonstration video walkthrough script.
