# F-05 — Candidate Invite Link Points to the Backend Host, Not the Web App

> **Finding:** F-05 (P1) · **Classification:** Defective Implementation · **Area:** Product / UX / Configuration · **UU PDP:** Not directly
> **Branch:** `fix/f05-invite-link-host` · **Status:** ✅ Completed & verified

---

## 1. Summary

`Session#invite_url` builds the candidate invite link from `APP_BASE_URL`, which points to the **API host** (`http://localhost:3001` in dev, `https://ai-interview-api.rakamin.com` in production). But the `/interview/:token` route only exists in the **web app** (React/Vite, `web/src/App.tsx`). As a result, the link sent to candidates opens a 404 / API JSON response, not the interview page — **the core workflow (invite → candidate starts interview) is broken**.

This is a **defective implementation**, not a missing feature: the link-generation code already exists and `APP_BASE_URL` is set, but one env var serves **two roles** (API base URL + invite-link base) and points to the wrong host for the second role.

**Impact:** candidates cannot start the interview from the invite link. The core product (AI interview) cannot be used through the candidate-facing path. No personal data leaks (the link carries an invite token, not data), so UU PDP is not directly affected — but trust in the invitation flow is broken.

## 2. Analysis & Gap to Ideal

**Root cause:** URL concepts were merged. `APP_BASE_URL` is used both as the general base URL **and** the invite-link base, yet the value points to the API. There is no separate "frontend URL" concept (Constraint Signal **CS-4**).

| File | Evidence | Gap |
|------|----------|-----|
| `api/app/models/session.rb:28-31` | `invite_url` → `ENV.fetch('APP_BASE_URL', 'http://localhost:3001')` — API host | Invite link points to API, not web app |
| `api/config/application.yml.sample:21` | `APP_BASE_URL: "http://localhost:3001"` | Sample value = API |
| `api/k8s/configmap.yaml:20` | `APP_BASE_URL: https://ai-interview-api.rakamin.com` — API subdomain | Production also wrong host |
| `api/config/routes.rb` | No `/interview/:token` route — only `/api/v1/*` | API has no such page |
| `web/src/App.tsx:57` | `/interview/:token` route exists in the React app | The frontend owns the interview page |

**Gap to ideal:**
1. Clear separation: `FRONTEND_BASE_URL` (for UI/invite) vs `APP_BASE_URL` (for API).
2. Invite URL points to the frontend: `https://ai-interview.rakamin.com/interview/:token`.
3. README documents the difference between both env vars clearly.

## 3. Options & Trade-offs

| Option | Configuration authority | Scope | Relative cost | Outcome |
|---|---|---|---|---|
| **A — Separate frontend URL** ✅ **CHOSEN & IMPLEMENTED** | Explicit `FRONTEND_BASE_URL` | Invite generation and deployment config | Low | Unambiguous, correct destination |
| **B — Reuse `APP_BASE_URL`** ❌ Not selected | Ambiguous shared variable | Config-only change | Low | Risks redirecting API consumers to the frontend |

### Option A — Introduce a separate `FRONTEND_BASE_URL` ✅ **CHOSEN & IMPLEMENTED**

Add env var `FRONTEND_BASE_URL`; `session.rb#invite_url` uses `ENV.fetch('FRONTEND_BASE_URL', default_frontend)`. Update `configmap.yaml`, `application.yml.sample`, README.

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Invite generation reads an explicit frontend base URL and produces the existing candidate route. |
| **Product Impact** | Candidates land on the usable interview page instead of an API 404. |
| **Cost & Complexity** | Low: one environment variable plus localized config, documentation, and tests. |
| **Long-Term Maintainability** | Separate API and frontend variables keep deployment intent explicit. |
| **Failure Modes** | Missing production configuration can fall back to a development host or produce unusable links. |
| **Operational Risks** | Environment drift between deployments can distribute incorrect invitation URLs. |
| **Mitigations** | Document and validate the variable, provide a clear development default, and test generated URLs. |
| **Contextual Fit** | Minimal and aligned with the existing split frontend/API deployment. |

### Option B — Just change the `APP_BASE_URL` value to the frontend host ❌ Rejected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | One shared base URL would point invites to the frontend while existing API consumers continue reading the same variable. |
| **Product Impact** | Invite links may work, but internal API calls can be redirected to the wrong service. |
| **Cost & Complexity** | Very low initially: configuration-only. |
| **Long-Term Maintainability** | Poor because one name retains two incompatible meanings. |
| **Failure Modes** | Changing the value fixes one caller while breaking another; future consumers cannot infer the intended host. |
| **Operational Risks** | A deployment config edit can cause broad routing failures outside the invite flow. |
| **Mitigations** | Audit every consumer and add routing tests, which still leaves the semantic ambiguity unresolved. |
| **Contextual Fit** | Unsuitable for an architecture with separately hosted API and frontend services. |

### Trade-offs accepted

| Trade-off | Justification |
|-----------|-------------|
| One new env var must be set in each deploy | Correct dev default (localhost:5173) keeps dev safe; production is set explicitly in the configmap. |
| No frontend refactor | Not needed — the frontend already has the correct route; just point the link there. |

## 4. Solution Implemented

- **`api/app/models/session.rb`:** `invite_url` now `ENV.fetch('FRONTEND_BASE_URL', 'http://localhost:5173')` → `"#{base}/interview/#{invite_token}"`. Invite host = frontend dev (5173) / frontend prod.
- **`api/config/application.yml.sample`:** added `FRONTEND_BASE_URL: "http://localhost:5173"`; `APP_BASE_URL` comment now explains it as the API base URL (not for invite links).
- **`api/k8s/configmap.yaml`:** added `FRONTEND_BASE_URL: https://ai-interview.rakamin.com` (frontend prod).
- **`api/README.md`:** two separate env var lines — `APP_BASE_URL` (API) and `FRONTEND_BASE_URL` (frontend, used for the invite link `FRONTEND_BASE_URL/interview/:token`).
- **`api/spec/models/session_spec.rb`:** new model spec (3 examples) for `#invite_url`.

**Key technical decision:** separating the two URL concerns (API base vs frontend) so they cannot contaminate each other. Frontend default (5173) matches the web app dev port (see `api/README.md` & `web/README.md`).

> **AI-Human Verification:** while writing the `application.yml.sample` comment, there was a typo ("backed by figures") fixed before finishing; no logic error affecting behavior in this finding. Details in section 7.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Invite URL points to the frontend | Create session | `invite_url` = `FRONTEND_BASE_URL + /interview/:token` | empty env → correct frontend dev default (5173) |
| 2 | API base stays correct | API request / read env | `APP_BASE_URL` remains API (unaffected) | — |
| 3 | Prod config updated | Deploy | configmap has correct `FRONTEND_BASE_URL` | forgotten → clear dev fallback, not silent 404 |
| 4 | README updated | Docs | both env vars documented | — |
| 5 | API host does not leak into the invite link | `APP_BASE_URL` set to API | invite_url contains no API host | regression guarded by spec |

## 6. Tests & Verification

**RSpec — `api/spec/models/session_spec.rb` (3 examples, 0 failures):**
- ✅ `invite_url` uses `FRONTEND_BASE_URL` (web app host, e.g. `https://ai-interview.rakamin.com`).
- ✅ Default when env is empty = `http://localhost:5173` (frontend dev, not 3001/API).
- ✅ Regression: changing `APP_BASE_URL` does not affect `invite_url`; API host does not leak.

**Full suite: 41 examples, 0 failures.**

**Seeded fault test:** temporarily restored `invite_url` to `ENV.fetch('APP_BASE_URL', 'http://localhost:3001')` → **all 3 examples FAILED** (expected frontend host, got `localhost:3001`) → proving the test truly catches F-05 → **reverted**, 41 pass again.

**Manual (verified):** generate an invite link → read `invite_url` from response/`rails runner` → host is `http://localhost:5173`/frontend, not API. The generated link was opened in the browser and the React interview page rendered (not 404/JSON API).

> **Status note:** implementation complete, all automated tests pass (41/41), and **manually verified** via UI (invite link points to the frontend & interview page renders).

## 7. AI-Human Verification

**AI mistake/risky moment:** while writing the comment in `api/config/application.yml.sample`, an ambiguous sentence ("backed by figures") appeared that could mislead the meaning of `APP_BASE_URL`. It was fixed to a neutral explanation that `APP_BASE_URL` is the API base URL (not for invite links).

**Verification:** the mistake was only in documentation comments, with no effect on runtime behavior; still corrected so the documentation does not confuse deploy operators.

---

*F-05 completed & verified: invite link points to the frontend, 41 RSpec passing, seeded fault proven.*
