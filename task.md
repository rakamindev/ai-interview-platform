# 🚀 Task Backlog: AI Interview Platform Revamp (Fullstack Product Engineer)

**Target Deadline:** Rabu, 19 Agustus, 13:00 WIB  
**Repository:** `rakamindev/ai-interview-platform`  
**Branch Strategy:** `feature/revamp-fullstack-engineer` (Off `main`)

---

## 📌 Phase 1: Setup & Baseline Testing Harness

- [x] **1.1 Web App Setup & Testing Infrastructure**
  - [x] Install Vitest & React Testing Library di `web/`.
  - [x] Konfigurasi test runner & tambahkan script `npm run test` di `package.json`.
- [x] **1.2 API Testing Infrastructure**
  - [x] Konfigurasi RSpec harness di `api/` (`spec/spec_helper.rb`, `spec/rails_helper.rb`).
  - [x] Buat *Seeded Fault Test* pada RSpec untuk memastikan test suite mendeteksi kegagalan logika.

---

## 📌 Phase 2: Audit & Problem Definition (P0 - P3)

- [x] **2.1 P0 (Critical) Audit**
  - [x] Audit Keamanan & PDP (Perlindungan Data Pribadi UU PDP): Pastikan tidak ada PII kandidat di logs/payload.
  - [x] Audit kegagalan API/Integrasi Gemini AI & Sidekiq background jobs.
- [x] **2.2 P1 (High) Audit**
  - [x] Audit kalkulasi skor/kriteria penilaian kandidat (skills yang belum dinilai, missing rating).
  - [x] Audit penanganan error & penulisan data parsial (*partial writes*).
- [x] **2.3 P2 (Medium) UI/UX Polish**
  - [x] Audit komponen frontend: loading states, empty states, error boundary, responsive layout, & text overflow.
- [x] **2.4 P3 (Low) Technical Debt**
  - [x] Catat utang teknis arsitektur, migrasi DB yang belum *reversible*, atau refactoring tipe data.

---

## 📌 Phase 3: Trade-off Evaluation & Architecture Strategy

- [x] **3.1 Opsi Solusi Architecture (Option A vs Option B)**
  - [x] Evaluasi Opsi A (Monolithic PR / Single-pass Revamp) vs Opsi B (Modular Sub-PR / Micro-services seam).
  - [x] Buat pertimbangan: Impact vs Cost, Maintainability, Failure Modes, & Contextual Fit.
- [x] **3.2 Self-Defined Acceptance Criteria**
  - [x] Dokumentasikan ekspektasi perilaku sistem untuk seluruh *edge cases* sebelum menulis kode.

---

## 📌 Phase 4: Monozukuri Implementation

- [x] **4.1 Backend (`api/`) Revamp**
  - [x] Perbaiki endpoint API & logika komputasi data wawancara.
  - [x] Buat database migration yang *reversible* dan aman untuk data existing.
  - [x] Implementasikan RSpec coverage untuk unit & integration test.
- [x] **4.2 Frontend (`web/`) Revamp**
  - [x] Tingkatkan UI/UX: Hirarki tata letak visual modern, mikro-interaksi, & status responsif.
  - [x] Integrasikan error handling & feedback visual untuk kegagalan pemanggilan AI/API.
  - [x] Tulis unit test frontend menggunakan Vitest.
- [x] **4.3 AI & Fault Verification**
  - [x] Catat minimal 1 *momen verifikasi AI* (kode AI yang salah/berisiko beserta perbaikannya).

---

## 📌 Phase 5: Submission Artifacts & Deliverables

- [x] **5.1 Pull Request GitHub**
  - [x] Buat Pull Request bersih ke `rakamindev/ai-interview-platform` dengan deskripsi komprehensif.
- [ ] **5.2 Video Demo (3 - 5 Menit)**
  - [ ] Rekam walkthrough pengguna end-to-end, penjelasan problem P0-P3, & demo perbaikan fitur (Loom/YouTube Unlisted).
- [x] **5.3 Laporan Akhir Single PDF**
  - [x] Susun laporan PDF mencakup: PR Link, Narasi Eksekusi, Matriks Trade-off, Acceptance Criteria, Test Proofs, Screenshots UI, & Video Link.