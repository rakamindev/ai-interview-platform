# Git Commit Message — AI Interview Platform Revamp

> Body message siap pakai. Subject (baris pertama) opsional di atas, body di bawah.

**Subject (saran):**
```
feat: revamp AI interview platform end-to-end (interview, auth, multi-tenant, UI/UX)
```

---

## Body

```
- P0 — Blocker: model Gemini dipindah ke env config (GEMINI_LIVE/FLASH/PRO_MODEL)
  karena model hardcode sudah deprecated; fix alur kandidat masuk sesi
  (hardware check + invite link)

- P1 — Inti interview:
  * silence pump delay 1s → 2.5s (AI tidak memotong kandidat saat jeda)
  * system prompt dipangkas ±10KB → ±8.6KB + rule tegas (cegah kebocoran teks internal)
  * end-sesi hanya via backend (coverage terverifikasi), bukan berdasar kata AI
  * graceful exit: AI tutup interview transparan & sopan
  * login sungguhan via DB (3 role: hiring_manager/assessor/recruiter),
    tutup backdoor token VITE_DEV_TOKEN

- P2/P3 — UI/UX polish:
  * font Inter, login page makeover
  * shared component: Breadcrumb, Alert, EmptyState, Combobox
  * 404 route, error states konsisten, dark mode fix (design token)
  * assessment list revamp: colored icons, filter BE-side + role title search + pagination
  * form revamp (card wrapper, section titles), role title combobox + anti-duplicate
  * portfolio/fit-gap/transcript revamp (two-column, level scale, verdict sidebar)

- P4 — Bug fixes & resilience (testing-based):
  * auto-end saat kandidat pamitan (Branch C fallback WRAP_UP_SIGNAL)
  * fix loop nudge kontradiktif menjelang waktu habis (check time_critical)
  * reconnect FE diselaraskan grace period BE (3→8 attempts, ~247s)
  * self-hosted speed test endpoint (httpbin jadi fallback)
  * time warning 10 menit (warn_600 + banner FE)

- Multi-tenant (subdomain-based):
  * kolom tenant_id di tabel users (migrasi nullable, tanpa FK, + index)
  * Organization.find_by_host — strict match tanpa fallback ke org default
  * login: subdomain (request.host) → resolve org → cek user.tenant_id == org.id → mint JWT
  * frontend derive API host dari window.location.hostname (hapus hardcode .env)
  * tenant name dinamis dari DB (hapus VITE_DEV_TENANT_*)
  * seeds: 3 tenant (ai_interview/test-corp/acme) + user terikat per tenant (idempotent)
  * login lintas-tenant ditolak: 401 "Account is not authorized for this tenant"

- Testing & validasi:
  * K-01 s/d K-22 verified (e2e manual, grep log node N5/N7/N9/N10,
    perbandingan transcript sebelum/sesudah fix, DB inspection, ruby -c, tsc --noEmit)

- Backlog (defer, dicatat jujur):
  * cross-tenant leak via unscoped Portfolio.find(id) — P1 security debt
  * RSpec test suite belum ada — P1
  * toast notifications, role assessor belum real, Sidekiq tenant context — P2
```

---

## Notes

- Branch: `fix/interview-revamp`
- Stack: Rails API + React 18 + PostgreSQL + Sidekiq + Gemini Live API
- Periode pengerjaan: 16–18 Agustus 2026
