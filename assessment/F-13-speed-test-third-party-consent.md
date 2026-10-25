# F-13 — Hardware Check Sends Traffic to External Third Parties Without Consent

> **Finding:** F-13 (severity: P2) · **Classification:** Missing Specification · **Area:** Privacy / Configuration / Frontend (Frontend Depth — High) · **UU PDP:** Yes
> **Branch:** `feat/f13-speed-test-consent` · **Status:** ✅ Completed & verified

---

## 1. Summary

When a candidate runs the hardware check before the interview, the browser sends requests — including a 0.5 MB POST — to **external third parties**: `www.google.com`, `cdn.jsdelivr.net`, `unpkg.com`, `httpbin.org`, and `postman-echo.com`. This happens because the default URLs in `web/src/utils/internetSpeedTest.ts` were hard-coded to external services, while the `VITE_SPEED_TEST_*` values in `.env` were empty (falling back to external). The platform actually **already had its own speed test endpoint** (`POST /api/v1/speed_test`) that was never used.

This behavior was **never explicitly defined** (missing specification): there is no design stating where hardware-check traffic should flow, that the platform's own endpoint should be used, or any consent/disclosure for data processing — the default "slipped in" through empty env values. Everything runs without errors, but the **candidate's IP and browser metadata flow to 5 third parties without disclosure**. Candidates cannot opt out (they are the assessed party, not the product's users), which engages **UU PDP (Law No. 27/2022)** principles of data minimization and transparent processing.

## 2. Analysis & Gap to Ideal

Root cause: the frontend speed test was built as "standalone, no backend dependency" with external default URLs; the env overrides exist but were empty → out-of-the-box behaviour uses third parties. The platform's own endpoint (`/api/v1/speed_test`) has been available in the backend from the start, yet no code ever used it — a frontend-backend coordination gap.

Code-level evidence (before the fix):

| File | Evidence |
|------|----------|
| `web/src/utils/internetSpeedTest.ts` | default URLs: `www.google.com/favicon.ico`, `cdn.jsdelivr.net/...`, `unpkg.com/...`, `httpbin.org/post`, `postman-echo.com/post` |
| `web/.env` / `.env.example` | `VITE_SPEED_TEST_UPLOAD_URL` empty → falls back to third parties |
| `api/config/routes.rb` | `POST /api/v1/speed_test` exists (discards payload, returns bytes) but is never used |

Gap to ideal condition:

1. Default speed test URLs point to the platform's own endpoint (`/api/v1/speed_test`).
2. `.env.example` is filled with internal URLs instead of empty values.
3. No request goes to external domains during the hardware check.
4. If the own endpoint is down, the speed test is skipped with a light message and the interview can still proceed (never block the candidate because of our own infrastructure).

## 3. Options & Trade-offs

| Option | Data destination | Candidate choice | Relative cost | Outcome |
|---|---|---|---|---|
| **A — Third-party fallback + consent** ❌ Not selected | Internal + external | Consent modal | Medium | Unnecessary disclosure remains |
| **B — Internal endpoint only** ✅ **CHOSEN & IMPLEMENTED** | Platform-owned | No external disclosure | Low | Privacy-preserving default |

### Option A — Use own endpoint as default + consent modal for third-party fallback ❌ Rejected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Internal testing falls back to an external provider after consent. |
| **Product Impact** | Preserves measurement but interrupts candidates and discloses network metadata. |
| **Cost & Complexity** | Medium: consent, fallback, auditability, and tests. |
| **Long-Term Maintainability** | Requires vendor and privacy-policy management. |
| **Failure Modes** | Consent may not be freely given and external service can fail. |
| **Operational Risks** | Vendor changes and cross-border processing add compliance burden. |
| **Mitigations** | Explicit opt-in, vendor review, minimization, and audit logs. |
| **Contextual Fit** | Poor because an owned endpoint is already sufficient. |

### Option B — Remove hard-coded external URLs; require the internal endpoint ✅ **CHOSEN & IMPLEMENTED**

Remove every external default; the speed test always uses the platform's own endpoints (derived from `VITE_API_BASE_URL`), with env overrides documented as internal-infrastructure-only.

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | The owned endpoint runs the test; failure skips the check without blocking interview start. |
| **Product Impact** | Preserves privacy and candidate access. |
| **Cost & Complexity** | Low because the endpoint already exists. |
| **Long-Term Maintainability** | Explicit internal configuration removes hidden vendor constants. |
| **Failure Modes** | Outages reduce measurement coverage; bad payloads distort results. |
| **Operational Risks** | Test traffic consumes owned bandwidth. |
| **Mitigations** | Non-blocking UX, payload validation, monitoring, and capacity limits. |
| **Contextual Fit** | Best fits data minimization and existing infrastructure. |

### Trade-offs accepted (for the chosen option)

| Trade-off | Justification |
|-----------|---------------|
| Losing the external CDN fallback flexibility | Data minimization (UU PDP): no lawful basis to send candidate data to third parties |
| Download measurement needs a payload from our own server → backend gains GET support | Small change (one route proc); honest measurement (real payload size from `blob.size`) |
| Skip behaviour (non-blocking) when infrastructure is down | Candidates must not be punished for the platform's infrastructure problems |

## 4. Solution Implemented

**Frontend (`web/src/utils/internetSpeedTest.ts`)** — rewritten:
- All external default URLs **removed**. Endpoints are resolved from `VITE_API_BASE_URL` at call time (`resolveEndpoints()`): ping → `GET /api/v1/health`, download → `GET /api/v1/speed_test?bytes=1048576`, upload → `POST /api/v1/speed_test`.
- Env overrides `VITE_SPEED_TEST_PING_URL` / `_DOWNLOAD_URL` (new) / `_UPLOAD_URL` remain supported, documented **for internal endpoints only** (e.g. a CDN in front of your own infrastructure). Read lazily per call for consistency and testability.
- Internals changed from "fake fallback values" (0.5/2/999) to `Measurement {value, ok}`: averages only over successful runs; `ok=false` when every attempt fails.
- New result flag `unavailable: boolean` = **any** metric failed at the network level (incomplete measurement — e.g. the `speed_test` endpoint is down while `health` still responds) → the UI skips with a light warning instead of blocking. Only when **all** metrics are measured and below threshold does `passed=false` hard-fail (block + retry).
- Download speed computed from the actual `blob.size` (not an assumed size), so any payload size measures correctly.

**Frontend (`web/src/components/HardwareCheck.tsx` + `web/src/utils/hardwareUtils.ts`)**:
- New `ProctoringState.SKIPPED` value (amber `AlertTriangle` icon, "Skipped" label).
- `internet` state: PASSED (pass) / SKIPPED (unavailable) / ERROR (measured below threshold).
- Light warning when SKIPPED: *"Speed test unavailable — your connection couldn't be measured. You can still continue."*; speed figures are **not** shown when unavailable (no fabricated 0/999 numbers).
- `allPassed` accepts `internet === PASSED || SKIPPED`; the camera/mic/audio chain still proceeds when SKIPPED → **Start Interview stays enabled**.

**Backend (`api/config/routes.rb`)**:
- `POST /api/v1/speed_test` kept (upload measurement, `received_bytes`).
- Added `GET /api/v1/speed_test?bytes=N` → fixed-size payload (capped at 5 MB, `Content-Length` set) for download measurement — still on the platform's own domain, single route proc, `via: %i[get post]`, public (unchanged).

**Config (`web/.env.example` + local `.env`)**:
- `VITE_SPEED_TEST_PING_URL` / `_UPLOAD_URL` / `_DOWNLOAD_URL` filled with internal URLs and documented "no third-party traffic, UU PDP".

> **AI-Human Verification:** Two AI mistakes/risky moments this session, both proven by the test suite:
> 1. **Test design:** the HardwareCheck component test initially used fake timers (`vi.useFakeTimers`) — the mic level monitor schedules itself via `requestAnimationFrame(update)` recursively, which was faked → unbounded loop → 2 tests timed out. Fixed: dropped fake timers (real timers + `findBy`/`waitFor` timeouts) and stubbed `requestAnimationFrame` to noop. Verified: 3/3 component tests green.
> 2. **`unavailable` semantics too strict (found during manual verification):** the initial definition required *all* metrics to fail. During manual verification with Network request blocking `*speed_test*`, only download + upload failed — ping (`/health`) still succeeded → `unavailable=false` → the UI **wrongly blocked Start Interview** even though the platform's own speed-test endpoint was down (AC #3). Fixed: `unavailable` = *any* metric unmeasurable (an incomplete measurement must not be the basis for blocking). Added a regression test reproducing this exact scenario (health up, speed_test down → `unavailable=true`).

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | Internal default | No env override | Speed test → own endpoints (`/api/v1/health`, `/api/v1/speed_test`) | Different `VITE_API_BASE_URL` host → all URLs follow the derivation |
| 2 | No external env | Empty config | **No request** to google/jsdelivr/unpkg/httpbin/postman-echo | Env override set → only internal hosts may be used |
| 3 | Own endpoint down | 500/network error on `speed_test` (health still up) | `unavailable=true` → internet row "Skipped" + light warning; interview can still proceed | Partial failure (e.g. only download+upload) → still skip, not ERROR — an incomplete measurement must not block the candidate |
| 4 | `.env.example` correct | Fresh clone | Internal URLs filled in, clear documentation | — |
| 5 | Network inspection | DevTools | Only requests to the platform's own domain during the hardware check | Download measured from actual `blob.size` (accurate for any payload) |
| 6 | Threshold not met | Measured, below minimum | `passed=false`, `unavailable=false` → ERROR + retry, Start disabled | No fake fallback values (0.5/2/999) that could pass thresholds |

## 6. Tests & Verification

- **Vitest `web/src/utils/__tests__/internetSpeedTest.test.ts`** (5 tests) — all fetch URLs on the own base & never external hosts; internal env overrides honored; unreachable → `unavailable=true`; **speed_test down but health up → `unavailable=true` (regression from the verification finding)**; measured-below-threshold → `passed=false` & `unavailable=false`. ✅ passing.
- **Vitest `web/src/components/__tests__/HardwareCheck.test.tsx`** (3 tests) — pass → proceeds normally + Start enabled; unavailable → "Skipped" + warning + **Start stays enabled**; below-threshold → "Failed" + Start disabled + Retry. ✅ passing.
- **Total Vitest: 21/21** (5 files). **tsc --noEmit: exit 0.**
- **RSpec `api/spec/requests/speed_test_spec.rb`** (4 tests) — GET payload 1024 bytes; 5 MB cap; empty body without params; POST `received_bytes > 0`. ✅ passing. **Total RSpec: 52/52.**
- **Seeded fault test:** `https://httpbin.org/post` temporarily reinstated as the upload default → the "sends all speed-test traffic to the platform's own endpoints" test **FAILS** (`AssertionError: expected false to be true` at `startsWith(DEFAULT_API_BASE)`) → reverted → suite green again. Proven: the test catches third-party traffic regressions.
- **Manual (confirmed during verification):** `curl` (GET 1 MB `downloaded 1048576 bytes` + POST `{"received_bytes":524288}`); DevTools Network shows only `localhost:3001` requests (health + speed_test), zero third parties (AC #2 & #5); skip-path via Network request blocking `*speed_test*` → internet row "Skipped" + warning + **Start Interview stays enabled** (after the `unavailable` semantics fix).

## 7. AI-Human Verification

Two AI mistakes/risky moments, verified and corrected (detail in Section 4):

1. **Test design (fake timers + recursive `requestAnimationFrame`)** → 2 tests hung; fixed with real timers + rAF noop → 3/3 green.
2. **`unavailable` semantics too strict** — found through manual verification (Network request blocking `*speed_test*`: download+upload failed, ping succeeded → UI wrongly blocked Start). Fixed: `unavailable` = any metric unmeasurable (incomplete measurement). New regression test reproduces the exact scenario → green.

Both proven by suite results (not assumptions): Vitest 21/21, tsc exit 0, RSpec 52/52.

---

*F-13 completed & verified: 21 Vitest + 52 RSpec passing, seeded fault proven, manual verification confirmed (curl, DevTools own-domain only, skip-path), ready to merge into umbrella.*
