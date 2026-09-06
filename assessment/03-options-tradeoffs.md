# 03 — Opsi & Trade-off

Brief Step 4 menuntut 2–3 opsi + trade-off untuk tiap temuan besar, lalu **satu pilihan**.
Berikut blok per temuan. Untuk temuan yang sudah diimplementasikan, bagian "Pilihan"
merupakan keputusan yang memang mendarat di kode; untuk #1–#3 (backend) ini masih **rencana**
yang harus difinalisasi setelah Ruby terpasang.

Prinsip yang dipakai di hampir semua keputusan: **data yang hilang/gagal harus terlihat
sebagai hilang/gagal — bukan menyamar jadi nilai.** Itu inti tema "Integritas Penilaian".

---

## #1 — Loop transisi `StateEngine` memakai `probe_count` sama berulang (A1, P0)

> **✅ Sudah dieksekusi sesuai opsi B — lihat [04](./04-implementation.md) §2.5/2.6.**

- **Opsi A — Tiap transisi butuh probe baru.** `initiated → partial` harus dipenuhi 2 probe
  yang masuk *setelah* skill mencapai `initiated`. Paling setia ke HARD RULE PRD, tapi
  butuh melacak probe per-state → perubahan model/data, spec jadi lebih mahal.
- **Opsi B — Batasi lompatan per panggilan: maksimal satu state maju per `resolve_state`.**
  `not_yet → covered` tidak mungkin lagi dalam satu panggilan; tiap turn transkrip
  (panggilan berikutnya) bisa maju satu state lagi. Cheapest, `StateEngine` tetap pure
  function, diff minimal, seeded fault paling gampang (kembalikan loop aslinya = merah).
  Trade-off: coverage map bisa terlambat beberapa turn di kondisi ideal — harga yang layak
  dibayar demi tidak pernah *melompati*.
- **Opsi C — `probe_count` per lompatan (`2 × jumlah_state_dilompati`).** Tanpa skema baru,
  tapi semantik masih perkiraan: 4 probe berturut-turut tetap dianggap cukup untuk
  2 lompatan, padahal PRD bicara "probe yang menyentuh skill setelah state berubah".

**Pilihan (rencana): B** — kedalaman perbaikan vs biaya; A disimpan sebagai follow-up
yang sah kalau tim memilih interpretasi PRD yang ketat.

> **[PERLU SUARAMU: setelah membaca `state_engine.rb` sendiri (54 baris), finalisasi
> pilihan A/B/C dengan argumenmu sendiri — ini baris yang paling mungkin ditanya
> di defense: "tunjukkan di mana bug-nya, dan kenapa loop itu salah."]**

---

## #2 — Auto-advance mengarang `covered` + menghapus `last_signal` (A2, P0)

> **✅ Sudah dieksekusi sesuai opsi B — lihat [04](./04-implementation.md) §2.5/2.6.**

- **Opsi A — Hapus auto-advance sepenuhnya.** `partial` tetap `partial` sampai AI benar-
  benar menilai. Paling jujur; trade-off: skill yang sudah di-probe panjang bisa "stuck"
  di partial kalau AI berhenti menyentuhnya — perlu mekanisme aging yang berbeda.
- **Opsi B — Auto-advance tetap, tapi tidak menulis `covered` dan tidak menyentuh
  `last_signal`.** Status maksimal yang boleh diotomasi: `partial` → tetap `partial`,
  dengan `Rails.logger.warn` terstruktur (`session_id`, `skill_id`, alasan) supaya
  kegagalan terlihat (standar Observability). Bukti asli dari AI tidak pernah
  ditimpa string robot.
- **Opsi C — Status quo + log.** Terlalu murah: angka salahnya tetap terbit, hanya ada
  baris log yang tidak dibaca siapa pun.

**Pilihan (rencana): B** — menghapus perilaku yang mungkin disengaja tim (advance untuk
mencegah stuck) adalah keputusan produk; melindunginya dari *membuat bukti palsu*
adalah keputusan integritas yang bisa diambil kandidat.

> **[PERLU SUARAMU: finalisasi setelah baca worker-nya; pastikan kamu bisa menjelaskan
> kenapa `last_signal` itu penting (dibaca portfolio generator sebagai evidence).]**

---

## #3 — `level` hilang jadi L1 (A3, P1)

- **Opsi A — Tolak seluruh respons AI, jadwalkan retry.**
  Paling aman untuk integritas data; tapi satu skill bermasalah membatalkan seluruh
  portfolio, dan menambah beban biaya API.
- **Opsi B — Simpan skill itu dengan `ai_level` kosong + status `unknown`, tampilkan
  sebagai "belum dinilai" di UI.** Portfolio tetap terbit, data hilang tetap jujur
  terlihat. Biaya: perubahan validasi model (NOT NULL di `schema.rb:115` harus
  dikawal), tipe TypeScript, dan satu state UI baru.
- **Opsi C — Biarkan default L1 tapi tambahkan log warning.**
  Paling murah; tapi tidak menyelesaikan masalah aslinya — kandidat masih tetap dinilai
  level 1 secara salah, hanya sekarang ada baris log yang tidak dibaca siapa pun.

**Pilihan: B — ✅ sudah dieksekusi, lihat [04](./04-implementation.md) §2.7.** Alasannya:
prinsip "data hilang harus terlihat sebagai hilang, bukan menyamar jadi nilai terburuk".
Ini juga satu-satunya opsi yang memperbaiki backend dan frontend di jahitan yang sama
(frontend-nya — menampilkan "belum dinilai" — sudah tersedia berkat #5: `parseLevel`
mengembalikan `null` dan badge menampilkan ketiadaan, bukan angka karangan). Eksekusinya:
`Portfolios::LevelParser` + migrasi nullable dengan `down` yang dijaga + jahitan FE
`ai_level: number | null`.

---

## #4 — Confidence unknown ≠ LOW; `medium` ≠ "confirmed" (A4, P1) ✅ sudah diimplementasikan

- **Opsi A — Perbaiki per komponen (tambal 3 titik: `ConfidenceIndicator`,
  `FitGapReportPage`, `SkillPortfolioCard`).** Rejected: akar masalahnya satu nilai
  diinterpretasi di **tiga** tempat dengan tiga hasil berbeda — tambal titik-titik hanya
  menjamin titik keempat yang belum ada akan salah lagi.
- **Opsi B — Satu fungsi kanonik `toConfidenceLabel()` (di `web/src/utils/confidence.ts`)
  dengan empat hasil: HIGH / MEDIUM / LOW / **UNKNOWN**; semua titik baca memanggilnya.
  Hanya HIGH yang boleh disebut "confirmed"; nilai hilang tampil "not available".**
  Rejected: tidak ada — ini yang dipilih.
- **Opsi C — Biarkan LOW, ubah copy-nya.** Gagal: menyembunyikan masalah di balik
  kata yang tetap salah.

**Pilihan (mendarat di kode): B.** Bukti kontraknya hitam-putih di database
(`portfolio_skill.rb:4` `CONFIDENCE_LEVELS = %w[high medium low]`), jadi empat label UI
itu terjemahan, bukan penemuan.

---

## #5 — `parseLevel` gagal ≠ 1 (D5, P1) ✅ sudah diimplementasikan

- **Opsi A — Pertahankan fallback 1.** Rejected: persis bug A3 di sisi frontend — L1
  adalah rating kompetensi *terendah* ("Foundational" di `LEVEL_DESCRIPTIONS`), jadi
  kegagalan parsing dibalas dengan hukuman terberat pada kandidat.
- **Opsi B — Kembalikan `number | null`; cek `Number.isInteger` + rentang 1..5;
  pemanggil wajib menangani `null` secara sadar.** Dikontrakkan lewat komentar:
  `schema.rb:115,120` + `portfolio_skill.rb:10`. Pola `!= null` sudah dipakai di
  `ComparisonTable.tsx:53` — konvensi lama, bukan gaya baru.
- **Opsi C — `throw` untuk nilai rusak.** Rejected: payload datang dari API eksternal;
  satu skill cacat tidak boleh menjatuhkan seluruh halaman.

**Pilihan (mendarat di kode): B.** Efek beruntun yang jujur: `LevelRadio` dan
`OverridePanel` kini menerima `value: number | null | undefined` — dan *mengisi radio
dengan angka karangan* justru klaim bahwa "ada yang sudah dinilai", padahal tidak.

---

## #6 — `ai_level` `string` vs `number` (D5, P1) ✅ sudah diimplementasikan

- **Opsi A — Ubah ke `number` (1..5) di `types/index.ts`, ikut kontrak DB.** Serializer
  meneruskan integer apa adanya (`portfolios_controller.rb:181`); prefiks "L" adalah
  bahasa presentasi (`LEVEL_LABELS`), bukan bahasa API.
- **Opsi B — Pertahankan `string`, parse di boundary.** Rejected: kontrak yang ada
  (schema + model + controller) semuanya bilang integer; membuat frontend "berbohong"
  terus artinya setiap konsumen baru harus tahu untuk menebak.

**Pilihan (mendarat di kode): A.** Diverifikasi `tsc --noEmit` — perbaikan ini terutama
membunuh *kelas* bug (mis. `parseLevel` cabang `typeof === "number"` yang sebelumnya
selalu dilewati lalu lintas nyata).

---

## #7 — Error interview ≠ "Complete" (B1 + B2, P0) ✅ sudah diimplementasikan

- **Opsi A — Satu state baru `error` untuk semua kegagalan.** Cheapest, tapi
  menyatukan dua keadaan yang pemulihannya beda: wawancara yang **belum pernah mulai**
  (token kedaluwarsa, API mati) vs wawancara yang **sudah jalan lalu sambungannya habis**.
  Layar "Try again" untuk kasus kedua menyesatkan — transkrip sudah ada di server.
- **Opsi B — Dua state baru: `error` (tindakan: tanya ulang server → `Try again`) dan
  `connection_lost` (tindakan: sambung ulang → `Reconnect`, dengan kalimat eksplisit
  bahwa jawaban yang sudah diberikan **tidak hilang**).** Ini yang dipilih.
- **Opsi C — Tanpa state baru: toast global + tetap `complete`.** Rejected: mengulang
  bug aslinya — kegagalan yang terlihat seperti sukses.

**Pilihan (mendarat di kode): B.** Dipisah di **sumbernya** (`useAudioWebSocket.ts` —
`onStateChange("complete")` tadinya dipanggil di tiga tempat, sekarang hanya
`session_ended` yang jujur), bukan di gejala halamannya. Detail teknis yang menjaga
koreksinya agar tidak kebablasan (functional updater `prev === "error" ? "idle" : prev`,
guard kebalikan `session_ended` tetap hijau) ada di [05-testing.md](./05-testing.md).

---

## #8 — `LevelRadio` id di-scope + `aria-label` (E1, P1) ✅ sudah diimplementasikan

- **Opsi A — `useId()` di dalam komponen + prop `label?` untuk `aria-label`.**
  Otomatis untuk pemanggil sekarang *dan* pemanggil berikutnya — tidak ada yang perlu
  mengingat apa-apa. `aria-label` dibuat opsional supaya kelima pemanggil tidak dipaksa
  berubah serentak; yang di dalam `.map()` sebaiknya mengisinya.
- **Opsi B — Prop wajib `name`/`idPrefix`.** Rejected: "yang wajib diingat pasti
  terlupa di pemanggil berikutnya yang belum ditulis" — kegagalan desain, bukan
  kegagalan pengguna.
- **Opsi C — Registry global ber-counter.** Overkill untuk masalah yang
  `useId` selesaikan.

**Pilihan (mendarat di kode): A.** Dampak domainnya bukan kosmetik: sebelum perbaikan,
assessor yang mengklik "L4" di skill kedua mengubah **skill pertama** — dan vacancy itu
menjadi patokan penilaian setiap kandidat pelamarnya.
