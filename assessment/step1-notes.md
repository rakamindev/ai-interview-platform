# Working Notes — Step 1: Setup & Local Exploration

Repo lokal: `ai-interview-platform/`
Semua service jalan:
| Service | Port | Status |
|---|---|---|
| PostgreSQL (docker `ai-interview-db`) | 5433 | ✅ |
| Redis (existing) | 6379 | ✅ |
| Sidekiq | — | ✅ |
| Rails API | 3001 | ✅ `/api/v1/health` 200 |
| Web (Vite) | 5173 | ✅ 200 |

Env:
- Ruby 3.3.2 via rbenv (global)
- Node 20, npm 10.8.2
- `api/config/application.yml` dibuat dari sample (DB port 5433, dummy GEMINI_API_KEY)
- Token admin (test-corp) di-embed ke `web/.env` → `VITE_DEV_TOKEN`
- Seeded: org "Test Corp" + 22 skill taxonomy B7

## Temuan eksplorasi (belum diverifikasi penuh)

1. **`invite_url` salah port** — mengarah `http://localhost:3001/interview/...` (backend), padahal route interview ada di frontend (5173). Link invite kandidat broken di setup lokal. Root: `APP_BASE_URL` dipakai sebagai base invite.

2. **Error response bocor stack trace** — response 4xx/5xx menyertakan `exception` + `traces` lengkap (ActionController debug). Risiko info disclosure production.

3. **Anchor fields wajib untuk skill taxonomy** — create assessment butuh `l1_anchor`..`l5_anchor` diisi manual walau skill dari taxonomy (SK-ENG-002) sudah punya anchor. Duplikasi data + friction.

4. **`system_prompt` null di response create** — worker async jalan setelah response dikirim; response bilang `system_prompt_generated: true` walau belum ada. Race kondisi UI "generated" vs kenyataan.

5. **`system_prompt` jadi 10KB** — compiler menghasilkan prompt panjang; kalau di-response-assessments selalu, payload besar (web `AssessmentListPage` butuh cek apakah fetch prompt tiap list).

6. **Cross-tenant via login** (dari security audit) — `User` tak terikat tenant + header `X-Tenant-Scheme` bebas.

7. **Tenant resolution pakai JWT tanpa verifikasi** (dari security audit) — `decode_without_verification` di middleware.

8. **invite_token bocor** — `session_json` expose `invite_token` + `invite_url` ke assessor; token juga jalan via URL.

## Yang belum dicek (Step 2 lanjutan)
- WebSocket audio/coverage flow
- Coverage analyzer worker + state engine
- Fit-gap engine + portfolio generator
- PDF export
- UI state handling (loading/empty/error) di web
- Database records aktual & API payloads detail
- `PortfolioSkillsController#override`, `VacanciesController`
