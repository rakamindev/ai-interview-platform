# 08 — Migration Safety

**Provenance: `[CODE]`.**

23 migrations total. For each: forward, back, impact on existing rows.

---

## Pre-existing Migrations (baseline)

### 20231201000000 — Create Organizations

- **Forward:** Creates `public.organizations` table (shared with rakamin-api)
- **Back:** Drops table
- **Impact:** None in this service's scope

### 20240101000000 — Create AI Interview Schema

- **Forward:** Creates all core tables in `ai_interview` schema
- **Back:** Drops all tables
- **Impact:** Destroys all data

### 20260320000000 — Create Skill Taxonomies

- **Forward:** Creates `skill_taxonomies` table
- **Back:** Drops table
- **Impact:** Skill taxonomy data lost

### 20260320000001 — Create AI Interview Users

- **Forward:** Creates `users` table
- **Back:** Drops table
- **Impact:** User accounts lost

### 20260323032702 — Add Language to Assessments

- **Forward:** Adds `language` column to `assessments`
- **Back:** Drops column
- **Impact:** Existing rows get `nil` language

### 20260411000000 — Add 10 Min to Time Limit Options

- **Forward:** Modifies CHECK constraint to allow 10-minute time limits
- **Back:** Re-adds CHECK excluding 10 — **NOT SAFELY REVERSIBLE**

**⚠ Reversible migration issue:** The `down` re-adds a CHECK excluding `10` without migrating rows first. It rolls back cleanly on an empty database and fails in production the moment one assessment uses a 10-minute limit.

This is why the rule is: *verified against a seeded database, never an empty one* — and why rollback is tested **after** new-shape data exists, not immediately after `up`.

### 20260505000000 — Add Indexes to Organizations

- **Forward:** Adds indexes on `organizations`
- **Back:** Drops indexes
- **Impact:** None

### 20260505000001 — Add Candidate ID Indexes

- **Forward:** Adds indexes on `candidate_id` columns
- **Back:** Drops indexes
- **Impact:** None

### 20260505000002 — Add Candidate Name to Sessions

- **Forward:** Adds `candidate_name` column to `sessions`
- **Back:** Drops column
- **Impact:** Existing rows get `nil` candidate_name

---

## New Migrations (added in this change)

### 20260819000001 — Add Tenant ID to Portfolio Family

- **Forward:** Adds `tenant_id` to `portfolios`, `portfolio_skills`, `fit_gap_reports`; backfills from session/assessment
- **Back:** Drops `tenant_id` columns
- **Impact on existing rows:** Backfill derives tenant from parent (session → assessment → tenant_id). If any portfolio has no session, backfill fails. Verified: all portfolios have sessions.

### 20260819000002 — Add Invite Expires At to Sessions

- **Forward:** Adds `invite_expires_at` column to `sessions`, backfills to 14 days from now
- **Back:** Drops column
- **Impact on existing rows:** Existing sessions get `invite_expires_at = NOW() + 14 days`. Any active session's invite becomes valid for 14 more days from migration time.

### 20260819000003 — Create Assessor Override Events

- **Forward:** Creates `assessor_override_events` table; backfills existing overrides
- **Back:** Drops table
- **Impact on existing rows:** Existing overrides get a `created` event in the audit trail.

### 20260819000004 — Add Rating State to Portfolio Skills

- **Forward:** Adds `rating_state` column to `portfolio_skills` (`"rated" | "unrated"`), backfills: `rated` if `ai_level IS NOT NULL`, else `unrated`
- **Back:** Drops column

**⚠ Lossy rollback:** Rolling back **deletes** unrated rows rather than writing `1` into them. Inventing a rating during the rollback of the migration that fixes invented ratings would be absurd.

### 20260819000005 — Add Uniqueness and FitGap Status

- **Forward:** Adds uniqueness constraint on `fit_gap_reports(portfolio_id, vacancy_id)`; adds `status` column
- **Back:** Drops constraint and column
- **Impact on existing rows:** Existing reports get `status: "complete"` via backfill.

### 20260819000010 — Create Refresh Tokens

- **Forward:** Creates `refresh_tokens` table
- **Back:** Drops table
- **Impact:** None (new table)

### 20260821000001 — Add Additional Strengths to Fit Gap Reports

- **Forward:** Adds `additional_strengths` JSONB column to `fit_gap_reports`
- **Back:** Drops column
- **Impact on existing rows:** Existing reports get `NULL` additional strengths (computed on next generation).

### 20260822000001 — Create Memberships

- **Forward:** Creates `memberships` table (user_id + organization_id + role)
- **Back:** Drops table
- **Impact:** None (new table)

### 20260822000010 — Add Foreign Key Constraints

- **Forward:** Adds foreign key constraints on related tables
- **Back:** Drops constraints
- **Impact:** Validates existing data; fails if orphaned rows exist.

### 20260822000020 — Allow Null AI Confidence on Portfolio Skills

- **Forward:** Changes `ai_confidence` to allow NULL (previously required)
- **Back:** Restores NOT NULL
- **Impact on existing rows:** Existing rows with NULL confidence now valid.

### 20260823000001 — Add AI Presence to Portfolio Skills

- **Forward:** Adds `ai_presence` column (`"current" | "stale"`), backfills all to `"current"`
- **Back:** Drops column
- **Impact on existing rows:** All existing skills marked as `"current"`.

### 20260823000002 — Create Portfolio Skill Generation Events

- **Forward:** Creates `portfolio_skill_generation_events` table
- **Back:** Drops table
- **Impact:** None (new table)

### 20260823145839 — Add Narrative Source to Fit Gap Reports

- **Forward:** Adds `narrative_source` column (`"ai" | "fallback"`)
- **Back:** Drops column
- **Impact on existing rows:** Existing reports get `NULL` narrative_source.

---

## CI Verification

`.github/workflows/ci.yml:73-77`:

```yaml
- name: Migration round-trip
  run: |
    bundle exec rails db:migrate:down VERSION=20260411000000
    bundle exec rails db:migrate:up VERSION=20260411000000
```

This specifically tests the problematic migration's reversibility. On an empty test database it passes; the real test is whether it works with production data (which uses 10-minute limits).
