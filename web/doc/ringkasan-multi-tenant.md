# RINGKASAN PERUBAHAN — MULTI-TENANT (SUBDOMAIN-BASED)

> **Konteks:** Lanjutan dari `ringkasan-phase-0.md` dan `ringkasan-ui-ux-polish.md`.
> Dokumen ini fokus ke satu hal: **mengamankan autentikasi login agar setiap user
> terikat ke tenant-nya masing-masing**, memakai pendekatan **subdomain** sebagai
> penentu tenant — tanpa dropdown/field pilihan tenant, tanpa hardcode di frontend.

---

## DAFTAR ISI

1. [Konteks & Motivasi](#1-konteks--motivasi)
2. [Ringkasan Perubahan](#2-ringkasan-perubahan)
3. [Arsitektur Multi-Tenant](#3-arsitektur-multi-tenant)
4. [Skenario Demo](#4-skenario-demo)
5. [Keputusan & Tradeoff (KISS)](#5-keputusan--tradeoff-kiss)

---

## 1. KONTEKS & MOTIVASI

### Kondisi sebelum perubahan

Aplikasi **sudah punya** fondasi multi-tenant, tapi **login belum aman**:

- **Tabel `users` tidak punya `tenant_id`** — satu user global, bisa dipakai di tenant mana pun.
- **Login resolve tenant dari `X-Tenant-Scheme` header atau "org pertama asal"** (`authentication_controller.rb` lama):
  ```ruby
  request.headers['X-Tenant-Scheme'].presence ||
    ActiveRecord::Base.connection.select_value('SELECT scheme FROM organizations LIMIT 1') || 'test-corp'
  ```
  Ini artinya **client bisa memilih tenant seenaknya** (lewat header), dan kalau tidak ada header, ambil org pertama secara non-deterministik.
- **Frontend hardcode tenant** lewat env: `VITE_DEV_TENANT_NAME="Demo Tenant"` / `"PT Rakamin Kolektif Madani"`.
- **Base URL API hardcode** `localhost:3001` di `.env` — subdomain tidak pernah sampai ke backend.

### Tujuan

1. Setiap user **terikat ke satu tenant** (`users.tenant_id`).
2. Tenant ditentukan **server-side dari subdomain** (`request.host`) — bukan dari input/header client.
3. Login lintas-tenant **ditolak** (401).
4. Nama tenant **dinamis dari DB**, tidak hardcode di env/frontend.

---

## 2. RINGKASAN PERUBAHAN

### M1.1 Kolom `tenant_id` di tabel `users`

- **File:** `api/db/migrate/20260818000001_add_tenant_id_to_users.rb` (new)
- **Apa:** Tambah kolom `tenant_id` (bigint) + index `idx_ai_interview_users_tenant_id` ke tabel `users`.
- **Kenapa:** Inilah titik yang hilang — tanpa `tenant_id`, tidak ada cara mengikat user ke tenant. Kolom ini **nullable** (untuk hindari merusak data existing) dan **tanpa FK** (konsisten dengan kolom `tenant_id` existing di `assessments`/`sessions`/`vacancies` yang juga tanpa FK).
- **Mekanisme:** `SET search_path TO ai_interview, public` di awal migrasi, karena tabel `users` hidup di schema `ai_interview`.

### M1.2 Strict host lookup — `Organization.find_by_host`

- **File:** `api/app/models/organization.rb`
- **Apa:** Tambah class method:
  ```ruby
  def self.find_by_host(host)
    return if host.blank?
    where(host: host)
      .or(where("alias_hosts && ARRAY[?]::varchar[]", host))
      .first
  end
  ```
- **Kenapa:** Method existing `Organization.identify` punya **fallback `default_organization` (id 0)** — kalau host tak dikenal, ia diam-diam return org default. Untuk login, perilaku ini **berbahaya**: host tak dikenal harus **ditolak**, bukan di-map ke org lain.
- **Mekanisme:** Match `host` kolom atau array `alias_hosts` (PostgreSQL array overlap). Tidak ada fallback.

### M1.3 Login resolve tenant dari subdomain + cek kepemilikan

- **File:** `api/app/controllers/api/v1/authentication_controller.rb`
- **Apa:** `authenticate` diubah:
  ```ruby
  organization = resolve_organization_by_host
  return json_error('Tenant not recognized', :unauthorized) unless organization
  unless user.tenant_id == organization.id
    return json_error('Account is not authorized for this tenant', :unauthorized)
  end

  token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: organization.scheme })
  json_response({
    token:,
    user:   { id: user.id, email: user.email, role: user.role },
    tenant: { id: organization.id, name: organization.name }
  })
  ```
- **Kenapa:** `request.host` membawa subdomain yang diketik user di browser (mis. `ai-interview.localhost`). Ini adalah identitas tenant yang **tidak bisa dimanipulasi client semudah header**. Cek `user.tenant_id == organization.id` mencegah user tenant A login di subdomain tenant B.
- **Alasan teknis untuk interview:** *"Tenant resolution harus server-side dan tidak dipercaya dari input client. Subdomain adalah carrier identitas tenant yang natural — sama seperti Slack/Notion (`acme.slack.com`). Login mengembalikan skema tenant (scheme) yang kemudian dibawa di JWT untuk semua request berikutnya."*

### M1.4 Seeds: 3 tenant + user per tenant

- **File:** `api/db/seeds.rb`
- **Apa:** Tiga organization + user yang terikat ke tenant masing-masing:

  | Org | scheme | host | user |
  |-----|--------|------|------|
  | AI Interview Test | `ai_interview` | `ai-interview.localhost` | `hiring_manager@rakamin.com`, `assessor@rakamin.com`, `recruiter@rakamin.com` |
  | Test Corp | `test-corp` | `test-corp.localhost` | `hiring_manager@test-corp.com`, dll |
  | Acme Corp | `acme` | `acme.localhost` | `hiring_manager@acme.com`, dll |

- **Kenapa:** Idempotent via `find_or_initialize_by` (org by `scheme`, user by `email`) — aman di-*re-run*, tidak duplikasi, tidak merusak data existing.
- **Catatan:** Org `ai_interview` (host `ai-interview.localhost`) **sudah ada** di DB shared (`public.organizations`) — seed di-align ke skema `ai_interview` (underscore) biar match, bukan bikin duplicate.

### M1.5 Frontend — base URL subdomain-aware

- **File:** `web/src/services/api.ts`
- **Apa:**
  ```ts
  const API_PORT = import.meta.env.VITE_API_PORT ?? "3001";
  const hostname = window.location.hostname;
  const BASE_URL   = import.meta.env.VITE_API_BASE_URL ?? `http://${hostname}:${API_PORT}/api/v1`;
  const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? `ws://${hostname}:${API_PORT}`;
  ```
- **Kenapa:** Sebelumnya `.env` hardcode `http://localhost:3001/api/v1` — subdomain hilang, backend selalu terima `Host: localhost`. Sekarang FE derive host dari `window.location.hostname`, sehingga browser mengirim `Host: ai-interview.localhost:3001`.

### M1.6 Frontend — tenant dinamis dari login (hapus hardcode)

- **File:** `web/src/stores/tenantAtom.ts` (rewrite), `web/src/stores/authAtom.ts`, `web/src/pages/auth/LoginPage.tsx`, `web/src/services/auth.ts`
- **Apa:**
  - `tenantAtom` sekarang baca/persist dari `localStorage` (`auth_tenant`), dengan `saveTenant()` / `clearTenant()`.
  - `LoginResponse` + `LoginUser` ditambah tipe `tenant: { id, name }`.
  - `LoginPage` simpan tenant (localStorage + in-memory) saat login sukses.
  - `clearAuth()` ikut memanggil `clearTenant()` — saat logout/401/403, tenant ikut dibersihkan.
- **Kenapa:** Tenant name muncul di header dari DB (hasil login), bukan dari env. Logout harus bersih — tidak meninggalkan tenant stale di localStorage.

### M1.7 Bersihkan env statis + Vite host

- **File:** `web/.env`, `web/.env.example`, `web/vite.config.ts`
- **Apa:**
  - Hapus `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_DEV_TENANT_ID`, `VITE_DEV_TENANT_NAME` (diganti komentar panduan).
  - `vite.config.ts` tambah `server: { host: true }` agar dev server bisa diakses via subdomain (`*.localhost`).
- **Kenapa:** Tidak ada lagi konfigurasi tenant/api yang hardcode. Vite perlu bind ke semua interface supaya `ai-interview.localhost:5174` (resolve ke 127.0.0.1) diterima.

---

## 3. ARSITEKTUR MULTI-TENANT

### 3.1 Konsep inti

- **"Tenant" = `Organization`** (tabel `public.organizations`, shared dengan rakamin-api), bukan model `Tenant` terpisah.
- **Row-level tenancy** — single PostgreSQL schema (`ai_interview`), isolasi via kolom `tenant_id` (bukan schema-switching / Apartment).
- **`scheme`** adalah identifier canonical tenant, disimpan di JWT sebagai claim.

### 3.2 Alur request lengkap

```
Browser: http://ai-interview.localhost:5174/login
   │  POST /auth/login   Host: ai-interview.localhost:3001
   ▼
TenantResolverMiddleware (semua request)
   │  resolve scheme: JWT → X-Tenant-Scheme → host
   │  (login belum punya JWT → pakai host)
   ▼
AuthenticationController#authenticate
   │  Organization.find_by_host("ai-interview.localhost")  → org id 1
   │  user.tenant_id == 1?  → ya → mint JWT { scheme: "ai_interview" }
   │  → return { token, user, tenant }
   ▼
FE simpan token + tenant → header tampil "AI Interview Test"
   ▼
Request berikutnya (GET /assessments) membawa JWT
   │  TenantResolverMiddleware decode scheme "ai_interview" → Current.tenant_id = 1
   ▼
Model query: TenantScoped → WHERE tenant_id = 1
```

### 3.3 Komponen yang sudah ada (fondasi, tidak diubah)

| Komponen | File | Peran |
|----------|------|-------|
| `TenantResolverMiddleware` | `app/middlewares/tenant_resolver_middleware.rb` | Set `Current.tenant_id` per-request |
| `TenantScoped` concern | `app/models/concerns/tenant_scoped.rb` | `default_scope` + auto-assign `tenant_id` |
| `Current` | `app/models/current.rb` | Thread-local state via RequestStore |
| `Organization` | `app/models/organization.rb` | Registry tenant + `identify` / `find_by_host` |
| `ApplicationController#require_tenant!` | `app/controllers/application_controller.rb` | Enforce tenant ada sebelum action |

### 3.4 Model dengan `tenant_id`

- **Langsung:** `assessments`, `sessions`, `vacancies`, `users` (baru).
- **Tidak langsung (via parent FK):** `assessment_skills`, `vacancy_skills`, `portfolios`, `portfolio_skills`, `fit_gap_reports`, `coverage_maps`, `transcript_turns`, `assessor_overrides`.

---

## 4. SKENARIO DEMO

Akses dashboard via **subdomain**, bukan `localhost` polos:

| Akses | Login | Hasil |
|-------|-------|-------|
| `http://ai-interview.localhost:5174` | `hiring_manager@rakamin.com` / `admin123` | ✅ Masuk, header "AI Interview Test" |
| `http://acme.localhost:5174` | `hiring_manager@acme.com` / `admin123` | ✅ Masuk, header "Acme Corp" |
| `http://acme.localhost:5174` | `hiring_manager@rakamin.com` | ❌ 401 "Account is not authorized for this tenant" |
| `http://unknown.localhost:5174` | siapapun | ❌ 401 "Tenant not recognized" |

> **Catatan:** `*.localhost` resolve ke `127.0.0.1` otomatis di browser modern — **tidak perlu edit `/etc/hosts`**. Port FE (`5174`) bebas; port API tetap `3001`.

---

## 5. KEPUTUSAN & TRADEOFF (KISS)

### 5.1 Yang dipilih (simple, cukup untuk production-ready demo)

- **Satu user = satu tenant** (`tenant_id` kolom tunggal di `users`), bukan tabel membership many-to-many. Cukup untuk demo isolasi; kalau butuh user lintas-tenant, itu pekerjaan terpisah.
- **Subdomain sebagai penentu tenant** (`request.host` → `host` kolom), tanpa dropdown/field di UI.
- **Tanpa migrasi denormalisasi** ke child tables — cukup guard di titik login.
- **Tanpa perubahan CORS** — `ALLOWED_ORIGINS` sudah `*` (dev).

### 5.2 Yang sengaja ditunda (nice-to-have, di luar scope quick release)

| Item | Alasan tunda |
|------|--------------|
| Membership table user↔tenant (many-to-many) | Over-engineering untuk demo |
| Denormalisasi `tenant_id` ke child tables (Portfolio, PortfolioSkill, FitGapReport, dll) | Butuh migrasi + backfill besar |
| Sidekiq tenant context | Bekerja "kebetulan" (RequestStore kosong di worker) — belum perlu |
| Fallback `Organization.identify` → org 0 | Masih ada di middleware, tapi login sudah pakai `find_by_host` yang strict |

### 5.3 Catatan keamanan yang perlu diketahui

- **`users` global by design** — isolasi sekarang enforced di layer login (`user.tenant_id == org.id`), bukan di level data user.
- **JWT `scheme` claim** masih dipakai untuk scope request pasca-login — ini sudah ada dan tidak diubah.
- Kebocoran **cross-tenant lewat `Portfolio.find(id)` unscoped** (dari audit sebelumnya) **belum** diperbaiki — itu fokus pekerjaan terpisah berikutnya.

---

*Dibuat: 18 Agu 2026 (Multi-tenant login: subdomain-based).*
