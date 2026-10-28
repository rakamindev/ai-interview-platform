# Environment & Tooling Setup Guide
## AI Interview Platform (`ai-interview-platform`)

Dokumen ini merupakan Single Source of Truth (SOT) untuk audit, instalasi, konfigurasi, dan verifikasi seluruh runtime, dependencies, database, dan service dependencies proyek sebelum masuk ke fase analisis produk maupun implementasi fitur.

---

## 1. Inventaris Status Kebutuhan vs Kondisi Sistem

| Komponen | Spesifikasi Proyek | Status di Host Windows | Lokasi / Catatan Teknis |
|---|---|---|---|
| **Sistem Operasi** | Linux / Windows x64 | **Aktif** (Windows x64) | User: `Engineer`, PowerShell terminal aktif |
| **Node.js** | v18+ (direkomendasikan) | **Terpasang (v24.14.1)** | `C:\Program Files\nodejs\node.exe` |
| **npm** | Bundled dengan Node | **Terpasang (11.11.0)** | `npm.cmd` |
| **Frontend Dependencies** | React 18, Vite 6, Tailwind, Radix | **Terpasang & Bersih** | `web/node_modules` (228 packages) |
| **Frontend Type-Check & Build** | `tsc && vite build` | **Lolos 100% (0 error)** | 1841 modules transformed, bundle dist siap |
| **Frontend Dev Server** | Port 5173 | **Aktif & Terverifikasi** | `http://localhost:5173` (HTTP 200 OK) |
| **Frontend Env** | `.env` mengarah ke port 3001 | **Dikonfigurasi** | `web/.env` dibuat, dev JWT token terpasang |
| **PostgreSQL** | Port 5432, schema `ai_interview,public` | **Aktif & Terverifikasi (v18.6)** | `C:\laragon\bin\postgresql\pgsql\bin\psql.exe` |
| **PostgreSQL Databases** | `rakamin_development`, `rakamin_test` | **Terbuat & Ekstensi Aktif** | Ekstensi `pgcrypto` dan `plpgsql` aktif |
| **Ruby** | `3.3.2` (per `.ruby-version`) | **Terpasang (3.3.2-1 DevKit)** | `C:\laragon\bin\ruby\ruby-3.3.2-x64\bin\ruby.exe` |
| **Bundler / Rails Gems** | Rails 7.0.10, Puma, pg, Sidekiq | **Terpasang & Lengkap** | 126 gems terinstal bersih via `bundle install` |
| **Database Migrations** | 9 file migrasi Rails | **Lolos 100%** | Seluruh tabel, enum, dan constraint terbuat |
| **Database Seeds** | Organizations, Skills, Taxonomies | **Lolos 100%** | Org id=1 `test-corp`, 22 pilot skills tersimpan |
| **Redis Server** | Port 6379, v6+ (Sidekiq 7 RESP3) | **Aktif & Terverifikasi (v8.10.2)** | `C:\laragon\bin\redis\redis-8.10.2` (PONG verified) |
| **Sidekiq Worker** | Background worker queue | **Aktif & Terverifikasi (v7.3.10)** | Daemon aktif, `tmp/sidekiq_status` = `READY: 1` |
| **Rails API Server** | Port 3001 | **Aktif & Terverifikasi** | `http://localhost:3001/api/v1/health` (200 OK) |
| **E2E Fullstack Integration** | Web 5173 <-> API 3001 <-> DB 5432 | **Terverifikasi di Browser** | Screenshot antarmuka assessments berhasil dimuat |

---

## 2. Bukti Verifikasi Operasional (Fakta Terverifikasi)

1. **Database PostgreSQL**:
   - `psql (PostgreSQL) 18.6` berjalan pada `localhost:5432`.
   - Database `rakamin_development` dan `rakamin_test` aktif dengan ekstensi `pgcrypto` dan `plpgsql`.
2. **Ruby 3.3.2 & Gem Dependencies**:
   - `ruby 3.3.2 (2024-05-30 revision e5a195edf6) [x64-mingw-ucrt]` terpasang bersama MSYS2 DevKit GCC 14.1.0.
   - Dependensi gem Rails (126 paket) berhasil diinstal.
   - Penambahan `gem 'tzinfo-data', platforms: %i[windows jruby]` untuk kompatibilitas timezone Windows.
3. **Database Migration & Seed**:
   - Seluruh 9 migrasi database berjalan sukses tanpa error:
     - `CreateOrganizations`
     - `CreateAiInterviewSchema`
     - `CreateSkillTaxonomies`
     - `CreateAiInterviewUsers`
     - `AddLanguageToAssessments`
     - `Add10MinToTimeLimitOptions`
     - `AddIndexesToOrganizations`
     - `AddCandidateIdIndexes`
     - `AddCandidateNameToSessions`
   - Seeding selesai: 1 organisasi tenant (`test-corp`, id=1) dan 22 skill taksonomi terdaftar.
4. **Redis 8 & Sidekiq 7**:
   - Redis server 8.10.2 berjalan di port 6379 dan merespons `PONG`.
   - Sidekiq 7.3.10 aktif terhubung ke Redis, menulis status `READY: 1` ke `api/tmp/sidekiq_status`.
5. **Rails API Server (Port 3001)**:
   - Konfigurasi `puma.rb` disesuaikan agar mendukung multi-platform (`Gem.win_platform? ? 0 : 2`).
   - Endpoint publik `/api/v1/health` merespons HTTP 200: `{"status":"ok"}`.
   - Endpoint berautentikasi `/api/v1/assessments` dengan JWT bearer token berhasil mengembalikan data tenant.
6. **Frontend Web & E2E Integration (Port 5173)**:
   - Dev token JWT otomatis di-generate dan dipasang pada `web/.env`.
   - Browser subagent berhasil memuat antarmuka frontend di `http://localhost:5173/assessments`, terautentikasi otomatis, dan menampilkan tenant `Test Corp` dengan data dari backend Rails.

---

## 3. Checklist Definition of Ready (100% Terpenuhi)

- [x] Node.js v24 & npm 11 aktif
- [x] Ruby 3.3.2 terpasang dan terkonfigurasi di PATH
- [x] Bundler dan 126 gems Rails terinstal
- [x] PostgreSQL 18.6 aktif di port 5432
- [x] Database `rakamin_development` & `rakamin_test` terbuat beserta ekstensi `pgcrypto`
- [x] Seluruh migrasi database Rails dijalankan
- [x] Seeding data awal selesai
- [x] Redis 8 aktif di port 6379
- [x] Sidekiq worker aktif (`READY: 1`)
- [x] Rails API berjalan di port 3001 dan lolos health check
- [x] Web frontend berjalan di port 5173 dan terintegrasi end-to-end ke API
- [x] Screenshot verifikasi browser tersimpan
