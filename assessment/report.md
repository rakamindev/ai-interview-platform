# Rakamin Take-home — Product Impact & Fit/Gap Reliability

**Status: final — siap direview melalui pull request.**  
Tanggal dokumentasi: 27 Oktober 2026  
Branch: `feat/fit-gap-trustworthy-revamp`  
Pull request: https://github.com/aldxynnn/ai-interview-platform/pull/8

## Ringkasan eksekutif

Perubahan berfokus pada keandalan dan kepercayaan terhadap alur Fit/Gap: keamanan akses lintas tenant, pembedaan skill yang belum dinilai dari gap yang didukung bukti, lifecycle report dan worker yang idempotent, konsistensi kontrak API–UI, penanganan kegagalan AI secara aman, serta regression tests dan CI.

## Step 1 — Memahami sistem dan baseline

Repository memisahkan `api/` (Rails, PostgreSQL, Sidekiq, RSpec, integrasi Gemini) dan `web/` (React 18, TypeScript, Vite, Tailwind, Radix UI). Petunjuk setup diperbarui agar mengacu pada direktori frontend `web/` yang benar. Workflow CI menjalankan API specs dan migration rollback/re-apply serta frontend tests dan production build.

## Step 2 — Produk, pengguna, dan dampak

Pengguna utama adalah assessor/recruiter yang membandingkan bukti kompetensi kandidat dengan kebutuhan vacancy; hiring manager menggunakan hasil sebagai salah satu masukan keputusan. Kandidat ikut terdampak walaupun tidak menggunakan dashboard secara langsung. Sistem harus mendukung keputusan manusia, bukan menyimpulkan kandidat tidak mampu hanya karena bukti belum tersedia.

Risiko produk utama:
- Akses lintas tenant dapat mengekspos portfolio, skill, vacancy, atau report kandidat.
- Label gap yang tidak akurat dapat menyesatkan keputusan hiring.
- Job gagal, duplikat, atau hasil usang dapat menghasilkan report tidak konsisten.
- Error provider AI dapat mengandung response body atau fragmen transcript yang tidak semestinya tersimpan di log.

Konteks Indonesia: transcript wawancara dapat memuat data pribadi, sehingga desain perlu mempertimbangkan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Ini merupakan identifikasi risiko teknis, bukan pendapat hukum.

## Step 3 — Temuan dan prioritas

| Prioritas | Temuan | Klasifikasi dan dampak |
|---|---|---|
| P1 | Resource portfolio/skill/report/vacancy harus dibatasi ke tenant aktif | Risiko otorisasi; cross-tenant regression tests memastikan request yang tidak berhak ditolak tanpa side effect. |
| P1 | Kontrak Fit/Gap API dan UI tidak konsisten pada level/override | Defect integrasi; payload dan tipe diselaraskan untuk menghindari interpretasi level yang salah. |
| P1 | Lifecycle report dan worker rentan pekerjaan ganda atau hasil usang | Risiko reliability; status, fingerprint, lease token, dan idempotency guard membatasi duplikasi dan stale result. |
| P1 | Lookup invitation gagal berisiko tampak seperti interview selesai | Defect error-state UX; UI menampilkan error dan retry, bukan completion palsu. |
| P2 | Skill tanpa bukti dapat disalahartikan sebagai gap | Ambiguitas produk; status `not_assessed` dibedakan dari gap yang didukung bukti. |
| P2 | Portfolio generation dapat gagal parsial atau menghilangkan override assessor | Risiko integritas data; output divalidasi sebelum write, transaksi digunakan, dan override manusia dipertahankan. |
| P2 | Error provider AI dapat berisi data sensitif | Risiko privasi; pesan error yang disimpan dan ditampilkan bersifat generik. |

**Defect konkret dan AI Verification Moment:** CI menangkap `DoubleRenderError` pada `Api::V1::PortfoliosController#find_vacancy!`. Helper merender error tetapi mengembalikan nilai truthy, sehingga action bisa berlanjut dan mencoba render lagi. Helper diperbaiki agar eksplisit mengembalikan `nil` setelah render error; request specs dan CI setelah perbaikan lulus.

Catatan akurasi: query vacancy tanpa `tenant_id` eksplisit tidak dengan sendirinya membuktikan bypass karena model menggunakan default scope `TenantScoped`. Implementasi menambahkan tenant condition eksplisit sebagai defense-in-depth. Eksperimen fault yang digunakan untuk bukti sengaja memakai `Vacancy.unscoped.find_by` untuk melewati default scope secara nyata.

## Step 4 — Alternatif dan trade-off

| Opsi | Dampak produk | Biaya dan maintainability | Risiko dan kecocokan |
|---|---|---|---|
| A. Trustworthy Fit/Gap end-to-end (**dipilih**) | Tinggi: otorisasi, kejelasan hasil, recovery | Biaya sedang; menyatukan lifecycle dan kontrak, tetapi menambah kompleksitas status | Race condition, stale job, dan provider failure perlu regression tests. Paling sesuai dengan data kandidat dan keputusan hiring. |
| B. Redesign visual luas | Berpotensi meningkatkan polish dan usability | Biaya tinggi dan banyak komponen berubah sekaligus | Risiko regression dan scope creep; tidak menyelesaikan trust boundary sebagai prioritas pertama. |
| C. Hanya menyelaraskan API/UI | Mengurangi mismatch dengan biaya rendah | Implementasi relatif sederhana | Otorisasi, duplicate job, dan integritas data tetap tidak tertangani. |

Opsi A dipilih karena menyelesaikan risiko berdampak tinggi dengan scope terukur. Trade-off-nya adalah kompleksitas lifecycle/retry, yang dikendalikan lewat regression tests dan dokumentasi. UI tetap mendapat perbaikan state penting tanpa redesign menyeluruh.

## Step 5 — Implementasi dan acceptance criteria

Perubahan implementasi:
1. Tenant-scoping pada portfolio, portfolio skill, vacancy, dan Fit/Gap report.
2. Penyelarasan kontrak API/UI untuk data Fit/Gap.
3. Pembedaan status `not_assessed` dari gap kompetensi.
4. Lifecycle report/scheduler/worker dengan status, fingerprint, lease token, dan idempotency guard.
5. Validasi hasil portfolio generator sebelum write, transaksi, dan preservasi override assessor.
6. Penanganan error provider AI dengan pesan generik dan tanpa logging raw provider response.
7. Penanganan invitation error dan retry pada UI.
8. Penambahan RSpec, Vitest/component tests, workflow CI, dan perbaikan petunjuk setup.

Acceptance criteria yang digunakan untuk review:
- Request tenant A terhadap resource tenant B ditolak dan tidak membuat side effect.
- Skill tanpa bukti cukup berstatus `not_assessed`; gap hanya didukung bukti yang memenuhi kriteria.
- Generation berulang dengan fingerprint sama tidak membuat pekerjaan duplikat; job lama tidak menimpa hasil baru.
- Kegagalan provider tidak membocorkan raw response/transcript ke log atau error tersimpan.
- Kegagalan invitation terlihat sebagai error yang dapat dicoba ulang, bukan completion.
- Portfolio generation memvalidasi output sebelum transaksi/write dan mempertahankan override assessor.
- Backend/frontend tests dan production build lulus.
- Manual review meliputi alur utama, state loading/empty/error/retry, data tidak lengkap, long text, responsive layout, keyboard/focus, dan console/network.

## Bukti pengujian

- **CI final yang tercatat sukses:** https://github.com/aldxynnn/ai-interview-platform/actions/runs/40452970096 — API RSpec dan migration rollback/re-apply, Web Vitest, serta production build.
- **Seeded fault:** commit https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316 sengaja menggunakan `Vacancy.unscoped.find_by`; CI gagal sesuai harapan karena cross-tenant regression test mendeteksi bypass (19 examples, 1 failure): https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272.
- **Recovery:** commit https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8e3f024ec8a8c78a5818d memulihkan tenant scope; CI recovery lulus: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460. Fault berada di branch scratch, bukan branch implementasi.
- Catatan teknis: [verification-notes.md](verification-notes.md).

CI menunjukkan checks otomatis pada commit terkait; manual smoke test dan pemeriksaan UI dilakukan oleh submitter sebagai bagian dari verifikasi akhir. Screenshot aktual dan rekaman walkthrough disiapkan sebagai materi demo submission.

## Privasi dan risiko

Transcript wawancara dapat memuat data pribadi. Sebelum penggunaan produksi, organisasi tetap perlu meninjau tujuan/dasar pemrosesan, pemberitahuan kandidat, minimisasi, retensi/penghapusan, kontrol akses, transmisi ke penyedia AI, penerima data, dan kewajiban UU PDP. Catatan ini bukan pengganti tinjauan legal formal.

## Demo dan submission

- Branch implementasi: https://github.com/aldxynnn/ai-interview-platform/tree/feat/fit-gap-trustworthy-revamp
- Pull request siap direview: https://github.com/aldxynnn/ai-interview-platform/pull/8
- CI: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40452970096
- Screenshot UI dan video walkthrough 3–5 menit telah disiapkan oleh submitter untuk materi demo submission.

Tanggal tenggat yang tertulis pada brief adalah Rabu, 19 Agustus 2026 pukul 13.00 WIB.
