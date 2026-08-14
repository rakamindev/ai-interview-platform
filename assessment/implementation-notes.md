# Catatan Implementasi (Step 5)

Log kerja pas eksekusi tiap sub-PR di [revamp-strategy.md](revamp-strategy.md).
Diisi berjalan pas ngoding, bukan direkonstruksi belakangan — biar detail AI
verification & bukti test gak ke-lupa pas nyusun PDF final.

## Link PR

| Sub-PR | Link |
|---|---|
| 1. Tenant Isolation Hardening | https://github.com/rakamindev/ai-interview-platform/pull/6 |

---

## Sub-PR 1: Tenant Isolation Hardening

- [x] Migration ditulis + di-test reversible (`rails db:rollback` lalu `db:migrate` lagi, schema balik sama, backfill re-run bersih)
- [x] Kode fix — `include TenantScoped` di `Portfolio`, `PortfolioSkill`, `AssessorOverride`, `CoverageMap`, `TranscriptTurn`, `FitGapReport`. **Controller-nya sendiri gak disentuh sama sekali** — `Portfolio.find`/`PortfolioSkill.find` otomatis ke-scope lewat `default_scope`, dan tiap call site udah punya `rescue ActiveRecord::RecordNotFound` yang balikin 404. Root-cause fix beneran nutup di 1 titik (model), bukan tambal 4 controller action.
- [x] Test ditulis, dijalanin, ijo — 33 example (6 model spec pola tenant-scoping via shared example + 2 request spec buktiin IDOR ketutup di endpoint asli: `export`, `fitgap`, `regenerate_fitgap`, `show_fitgap`, `portfolio_skills#override`)
- [x] Seeded fault test: branch `scratch/seeded-fault-tenant-isolation` — commit `ee4360e` cabut `include TenantScoped` dari `Portfolio`, jalanin test → **25/33 gagal** (model spec + request spec IDOR-nya persis merah). Revert via `git revert ee4360e` (commit `6c088d4`) → 33/33 ijo lagi. Kedua commit itu kesimpen di history branch scratch, gak di-squash.
- [x] Screenshot: lihat log run RSpec di atas (gagal → revert → ijo) — buat PDF ambil dari transcript sesi ini, belum ada screenshot terpisah.

### AI Verification Moment
Implementasi pertama gue tulis `self.tenant_id ||= session&.tenant_id` di tiap
model (pakai `||=` biar konsisten sama pola default `TenantScoped`). Kelihatan
benar secara inspeksi kode. Tapi pas dijalanin di RSpec, 6 test "excluded from
different tenant" gagal — hasil query nunjukin `tenant_id` record baru sama
dengan `Current.tenant_id` yang gue set di test, bukan tenant asli dari
session-nya.

Root cause (ketauan cuma dari run test, gak kelihatan dari baca kode): Rails
punya fitur "scope attribute pre-population" — `Model.new` otomatis ngisi
attribute dari kondisi equality di `default_scope` yang lagi aktif
(`where(tenant_id: Current.tenant_id)`) **sebelum** `before_validation`
sempat jalan. Jadi `self.tenant_id ||= session&.tenant_id` selalu no-op
karena `tenant_id` udah "keisi" duluan (dari `Current`, sumber salah) pas
`assign_tenant_id` baru mulai jalan.

Fix: ganti `||=` jadi `=` biar turunan dari parent (session/portfolio) selalu
menang, gak peduli udah keisi duluan atau belum. Ini bug yang murni AI
(gue) yang nulis salah dan cuma ketauan gara-gara nulis+jalanin test — kalau
cuma review kode manual tanpa run test, ini bakal ke-ship sebagai "root-cause
fix" yang sebenarnya masih bolong persis di IDOR yang mau ditutup.

### Catatan lain
- Data dev/test kosong pas migration jalan pertama kali — backfill gak bisa
  diverifikasi manual by-eye, jadi RSpec beneran satu-satunya cara valid buat
  nge-prove behavior-nya bener (bukan sekadar formalitas checklist).
- Ada polusi kecil di `rakamin_test` DB dari eksperimen debug manual pakai
  `rails runner` (gak transactional, gak ke-rollback) — sempet bikin 1 test
  gagal karena `UniqueViolation` di scheme organization, bukan bug beneran.
  Dibersihin via `TRUNCATE ... RESTART IDENTITY CASCADE`. Pelajaran: jangan
  debug pakai `rails runner` langsung ke `rakamin_test`, pakai `rails console
  -e test` di transaction block atau db terpisah kalau perlu lagi.


---

## Sub-PR 2: Not-Assessed Skill State

- [ ] Migration
- [ ] Kode fix (backend + frontend)
- [ ] Test
- [ ] Seeded fault test
- [ ] Screenshot

### AI Verification Moment

### Catatan lain

---

## Sub-PR 3: Candidate-Facing Error State

- [ ] Kode fix (frontend)
- [ ] Test
- [ ] Seeded fault test
- [ ] Screenshot

### AI Verification Moment

### Catatan lain

---

## Sub-PR 4: Hardware Check Reliability

- [ ] Endpoint baru di api/
- [ ] Kode fix (frontend + backend)
- [ ] Test
- [ ] Seeded fault test
- [ ] Screenshot

### AI Verification Moment

### Catatan lain

---

## Test Coverage — Ringkasan Akhir

<!-- diisi pas semua sub-PR kelar: command yang dijalanin, hasil, coverage kalau ada -->

## Claimed Engineering Depth

<!-- backend-heavy vs frontend-heavy, jujur porsi mana yang paling dalam digarap -->
