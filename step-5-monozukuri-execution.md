# Langkah 5 — Monozukuri Implementation & Pull Request

## Ringkasan eksekusi

Implementasi mengikuti Option A dari Langkah 4 dan mencakup API Rails serta UI React. Perubahan menutup batas otorisasi di backend, memvalidasi hasil AI sebelum menyimpan, membuat fit-gap generation idempotent, dan menegakkan kontrak API–UI saat runtime.

### Yang diimplementasikan

| Area | Implementasi |
|---|---|
| Tenant isolation & auth | Menambah membership user–organization dengan role dan status aktif. Login hanya menerbitkan JWT untuk membership assessor/admin aktif. Setiap request REST memuat ulang user dan membership dari database; role claim JWT tidak menjadi sumber otorisasi. Selector X-Tenant-Scheme yang berbeda dari tenant token ditolak. Portfolio, turunannya, fit-gap, vacancy, ekspor dan override dibatasi melalui tenant sesi. REST dan kedua WebSocket yang menerima JWT kini memerlukan membership dan role yang sesuai. |
| Data assessment | Menambah assessment_status dan assessment_reason pada skill portfolio. Level/confidence boleh null hanya pada not_assessed; check constraint database menjaga pasangan status/nilai. Skill lama yang sudah mempunyai skor dimigrasikan sebagai assessed karena histori bukti tidak cukup untuk merekonstruksi status lain. |
| AI evidence | Portfolios::EvidenceValidator hanya menerima rating integer 1–5, confidence enum, summary/quote dengan batas ukuran, dan sekurangnya dua kutipan yang cocok dengan dua turn kandidat tersimpan yang berbeda. Evidence disimpan sebagai {turn_id, quote}. Skor tidak lagi di-coerce/clamp. Skill tanpa output/bukti sah menjadi not_assessed; transkrip di atas 120.000 karakter gagal eksplisit dan tidak dipotong diam-diam. Isi transkrip disebut sebagai data tak tepercaya pada prompt. |
| Coverage | Menghapus promosi partial → covered berdasarkan probe count saja. Status coverage kini harus berasal dari update analyzer; jumlah probe sendiri tidak mengubah state menjadi covered. |
| Fit-gap | Menambahkan status, error code dan generation token pada report. Record dibuat sebelum job diantrekan; lock pada record menggabungkan polling/request bersamaan. Worker memeriksa tenant portfolio/vacancy dan token generation, sehingga job lama tidak dapat menimpa revision baru. Regenerate mempertahankan hasil valid sebelumnya; laporan lama dengan override ditandai perlu dibuat ulang. |
| API–UI | API dan TypeScript menggunakan expected_level, candidate_level nullable, result: not_assessed, serta is_override boolean. Zod memvalidasi response sebelum dipakai. UI membedakan skill belum dinilai, menampilkan bukti dan field persyaratan, menghentikan polling setelah state terminal, dan menyatakan error/retry tanpa mengklaim generation berhasil. |
| Test harness | Menambahkan RSpec unit tests untuk membership authorization, WebSocket coverage authorization, validasi evidence, idempotency service, dan hasil fit-gap; menambah test runner Node bawaan untuk validasi kontrak web tanpa dependency baru. |

## Bukti verifikasi yang sudah dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Dari api/: PATH=/Users/asep/.rbenv/versions/3.3.2/bin:$PATH bundle exec rspec | **12 examples, 0 failures** |
| Dari api/: PATH=/Users/asep/.rbenv/versions/3.3.2/bin:$PATH bundle exec rails zeitwerk:check | **All is good** |
| Dari web/: npm test | **4 tests passed** |
| Dari web/: npm run build | **TypeScript check dan Vite production build berhasil** |
| git diff --check | Bersih |

Peringatan Vite hanya tentang posisi komentar tree-shaking pada dependency Zod; build tetap berhasil.

## Seeded Fault Test

Ini adalah fault injection deterministik memakai fixture sintetis, bukan kredensial kandidat. Tes memasukkan beberapa kegagalan yang mewakili output AI rusak:

- level: "3", boolean, pecahan, 0, dan 6 alih-alih integer 1–5.
- Kutipan yang tidak ada dalam transkrip sumber.
- Dua kutipan dari turn kandidat yang sama, sehingga tidak membentuk dua evidence independen.
- Kutipan melebihi batas ukuran.
- Pada kontrak web, field lama required_level, level berbentuk string, atau hilangnya is_override.

Jalankan dari folder api/:

    PATH=/Users/asep/.rbenv/versions/3.3.2/bin:$PATH bundle exec rspec spec/services/portfolios/evidence_validator_spec.rb

Jalankan fault kontrak dari folder web/ bersama seluruh suite:

    npm test

Hasil normal: evidence/score yang gagal tidak menghasilkan rating tersimpan dan dipresentasikan sebagai not_assessed; contract parser menolak field atau tipe yang tidak sah. Suite normal menghasilkan 4 contoh API validator dan 4 kasus kontrak web lulus.

### Fault injection dengan riwayat scratch branch

Untuk memenuhi pemeriksaan bahwa assertion benar-benar menangkap regresi, branch lokal terpisah `codex/seeded-fault-proof` dibuat dari commit implementasi. Pada commit fault `96b0315`, batas rating validator sengaja diubah dari 1–5 menjadi 1–6. Tes `does not coerce strings, booleans, or out-of-range ratings` kemudian **gagal sesuai harapan**: nilai 6 diterima sebagai `assessed`, sedangkan assertion mengharapkan `not_assessed` (4 examples, 1 failure). Commit tersebut dibalik pada `3561c47`; tes yang sama dijalankan lagi dan lulus (4 examples, 0 failures). Kedua commit dipertahankan berurutan pada scratch branch untuk memperlihatkan inject → red → revert → green. Branch/worktree bukti ini lokal dan belum dipush.

## AI Verification Moment

Verifikasi lokal memakai payload model berbentuk JSON dan dua turn **kandidat sintetis** yang telah ditanam pada fixture test. Kutipan yang muncul pada turn 11 dan 12 menghasilkan assessment_status: assessed, ai_level: 3, serta evidence dengan kedua turn_id. Varian yang mengirim "3" sebagai string atau mengarang kutipan diturunkan menjadi not_assessed dengan reason code, tanpa menyimpan score.

Ini membuktikan validator dan jalur bukti secara offline; **tidak ada panggilan Gemini langsung pada sesi ini** dan tidak ada transkrip kandidat nyata yang digunakan. Uji live provider, akurasi semantik skill, serta perilaku model saat prompt injection masih perlu dijalankan pada environment dengan kredensial dan data sintetis yang disetujui.

### AI-assisted coding verification moment

Perbaikan Option A dan laporan audit masih melewatkan defect P1-06: `Session#invite_url` membentuk route kandidat pada `APP_BASE_URL` yang menunjuk host API Rails port 3001. Screenshot reproduksi menunjukkan Rails `No route matches GET /interview/:token`. Ini merupakan risiko kelengkapan dalam alur kerja coding/review berbantuan AI: temuan telah tercatat, tetapi tidak tertutup dalam perubahan awal. Verifikasi dilakukan terhadap dua route lokal—React/Vite pada port 5173 menerima path candidate, Rails pada port 3001 tidak memilikinya—lalu implementasi diganti ke `FRONTEND_BASE_URL`, dengan default localhost development dan fail-fast pada production tanpa konfigurasi. Rails runner memastikan URL sesi memakai host frontend. Ini mendokumentasikan kesalahan/risiko implementasi AI-assisted yang nyata, bukan mengklaim bahwa Gemini live telah diverifikasi.

## Migrasi dan persiapan tenant

Migrasi baru: api/db/migrate/20260924000000_add_tenant_memberships_and_generation_state.rb. Saat catatan Step 5 pertama ditulis, akses DB lokal dibatasi sandbox. Pemeriksaan ulang untuk audit Step 6 menunjukkan PostgreSQL lokal aktif dan semua migrasi, termasuk migrasi ini, berstatus **up** pada database development. Jalur migrasi test DB kosong/upgrade dan CI tetap perlu dijalankan.

Membership user lama sengaja tidak di-backfill otomatis. User tanpa membership tidak dapat login/mengakses tenant REST. Seed development membuat akun admin test-corp lokal dan membership; jangan menjalankannya untuk provisioning produksi. Pemilik tenant harus memetakan user produksi ke organisasi yang benar. Verifikasi constraint, index unik, foreign key ke organisasi, dan regresi request dua tenant pada CI/database integrasi.

## Pull request

Commit branch feature/product-engineer-revamp tersinkron dengan origin menurut remote-tracking ref. URL /pull/new/feature/product-engineer-revamp adalah halaman pembukaan PR, bukan URL PR bernomor. Pada audit Step 6, `gh auth status` menunjukkan token GitHub invalid, sehingga status PR/review/merge belum dapat diverifikasi atau dibuat melalui CLI. Sebelum submission, buat PR dari branch tersebut dan catat URL PR kanonis serta CI/reviewer.

## Batas verifikasi dan follow-up

- RSpec yang dijalankan adalah unit/service tests dengan dependency database digandakan. Belum ada request integration test terhadap PostgreSQL nyata. Migrasi, constraint, transaksi unik, locking lintas koneksi, serta foreign key perlu diverifikasi pada CI/database test sebelum merge.
- Uji tenant REST/WebSocket memakai membership test double; lakukan uji black-box dua tenant setelah database aktif dan provisioning selesai.
- Live Gemini verification belum dilakukan; hasil provider tidak boleh diklaim tervalidasi secara semantik.
- Batas retensi/penghapusan data, notice kandidat, dasar pemrosesan, DPIA, wilayah/transfer Gemini, dan proses keberatan tetap keputusan Pengendali/Legal sesuai Constraint Signal Langkah 4.
- User/tenant provisioning produksi belum disediakan sebagai UI/API admin pada perubahan ini. Kegagalan tertutup disengaja sampai membership diberikan secara sah.
- Web tidak menggunakan Vitest: TypeScript contract dikompilasi lalu diuji dengan native Node test runner. Empat contract tests lulus, tetapi tidak ada line/branch coverage terukur atau component/e2e tests.
- Down migration menolak rollback apabila terdapat skill `not_assessed`, karena skema sebelumnya mewajibkan ai_level dan confidence non-null. Ini melindungi data dari rollback lossy, namun membuat migrasi hanya reversibel sebelum status baru tersebut digunakan; rencana rollback sesudahnya memerlukan restore/forward-fix.
