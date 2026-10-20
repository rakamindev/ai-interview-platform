# Pilar 1 — The Product

> "Use it end to end before you judge it. Read what it does, not what the code implies it does."
> Status 2026-10-20: mulai dipakai end-to-end (lokal, puma 3001 + Vite 5173 + DB OrbStack 25432). Temuan runtime di §Temuan runtime; sisanya masih hipotesis.
> Sumber di bawah: spesifikasi PRD di wiki + jejak kode. Semua klaim perilaku dari kode = **hipotesis** sampai diamati saat runtime.

## Sumber spesifikasi
- Wiki `rakamindev/ai-interview-platform` (clone: `git clone https://github.com/rakamindev/ai-interview-platform.wiki.git`):
  - **PRD 01 — First Principles: AI Interview Behavior**: "dokumen terpenting"; perilaku AI adalah produknya. Isi: template system prompt (N2), injeksi coverage map (B6), prompt coverage analyzer (N7, Gemini Flash), prompt portfolio generator (N10, Gemini Pro), contoh probing, daftar failure mode QA.
  - **PRD 02 — Real Simulation: End-to-End Interview**: skenario referensi (Dimas, HR lead TechCorp → kandidat Ahmad, Senior Frontend, 3 skill, 45 menit, selesai 38 menit karena semua skill `covered`).
- Kode node di komentar mengikuti PRD: N1 config, N2 prompt, N4 session, N5 Gemini Live, N6 transcript, N7 coverage analyzer, N8 coverage map, N9 end, N10 portfolio, N11 simpan, N13 fit/gap, N14 PDF; UI U5 live monitor, U7 portfolio, U10 fit/gap; B6 injeksi, B7 skill taxonomy.

## Apa yang produk ini lakukan (menurut PRD)
1. **Setup (assessor)**: isi role, time limit, skill (dari taxonomy B7 atau custom: scope + anchor L1–L5 + expected level) → sistem membuat system prompt → buat link undangan → kirim ke kandidat (manual, mis. email).
2. **Interview (kandidat)**: buka link → izinkan mic → AI menyapa dan bertanya terbuka → AI mem-probe jawaban spesifik kandidat (bukan daftar pertanyaan), minimal 1 follow-up per skill, menantang proporsional, mengejar skill yang muncul di luar agenda (discovered, 2–3 exchange), transisi natural, menutup saat semua `covered` atau waktu habis.
3. **Coverage live**: tiap turn kandidat → analyzer async (lag 1 turn dianggap wajar) → state `not_yet → initiated → partial → covered`; aturan keras: tidak bisa melewati `initiated` sebelum `probe_count ≥ 2`; `covered` = "bisa mempertahankan level L1–L5 dengan 2–3 kutipan". Assessor melihat perubahan state secara live.
4. **Portfolio**: setelah sesi, Gemini Pro menilai tiap skill → level, confidence (high/medium/low dari probe_count & state), 2–3 kutipan kandidat, ringkasan kompetensi; discovered skill memakai anchor universal L1–L5.
5. **Review & keputusan**: assessor membaca bukti, menyetujui/override level, jalankan fit/gap terhadap vacancy (Required vs kandidat → Match/Gap/Exceed + narasi budaya oleh LLM), export PDF.
6. **Ketahanan**: GoAway Gemini → reconnect dengan resumption handle, kandidat tidak merasakan jeda.

## Spesifikasi yang tidak pernah didefinisikan (missing specification)
- Hasil untuk skill yang **tidak sempat dinilai** (waktu habis, sesi putus, kandidat diam): PRD hanya punya skenario "semua covered"; prompt N10 tetap meminta level untuk *setiap* skill.
- Apa yang dilihat/diterima **kandidat**: persetujuan, pemberitahuan bahwa AI yang mewawancarai dan data dikirim ke Google, hasil/feedback, cara keberatan atau minta hapus data. PRD hanya: "you'll hear back shortly".
- Bahasa: PRD seluruhnya bahasa Inggris; kode mendukung `en`/`id` (`assessments.language`).
- Akses, retensi, dan siapa pemilik data (tenant klien vs Rakamin); keputusan manusia vs AI (PRD: assessor "agrees AI rating looks right" — tidak ada aturan kapan wajib review).
- Kegagalan model (timeout/JSON rusak/rating hilang) dan duplikasi job.
- Teks UI kandidat sebelum mulai (PRD: "This is a 45-minute audio interview. Click the mic to start").

## Perbedaan PRD ↔ kode (dari membaca kode, belum diverifikasi runtime)
| Area | PRD | Kode |
|---|---|---|
| Injeksi coverage | `clientContent` turn `[COVERAGE MAP — DO NOT SPEAK THIS]` sebelum tiap respons AI | `realtimeInput.text` `[COVERAGE_MAP]…[/COVERAGE_MAP]` hanya bila fingerprint berubah (`api/app/services/coverage/map_injector.rb:42`, `api/app/clients/gemini/live_client.rb:91-95`); transkrip AI disaring dari metadata yang bocor (`api/app/channels/audio_websocket_middleware.rb:271-274`) |
| Mulai sesi | `POST /api/sessions/:token/start` | tidak ada endpoint start; sesi aktif saat WebSocket audio terbuka (`Sessions::StartHandler`); halaman kandidat menjalankan HardwareCheck dulu |
| Pembuatan prompt | saat sesi dibuat | saat assessment dibuat/diubah (Sidekiq) + fallback saat WS terbuka |
| Fit/gap "Required" | kolom Required = expected level vacancy | backend mengirim `expected_level`, web membaca `required_level` (`web/src/components/fitgap/ComparisonTable.tsx:50`) → hipotesis: kolom kosong |
| Skill tanpa bukti | tidak didefinisikan | level hilang/tidak valid → `.to_i.clamp(1, 5)` = L1 (`api/app/services/portfolios/generator.rb:161,173`); kolom `ai_level` NOT NULL → hipotesis: dinilai L1 lalu "Gap" di fit/gap |
| Override assessor | tidak ada di PRD 02 | ada (`OverridePanel`, `POST /portfolio_skills/:id/override`); penanda override di fit/gap tidak pernah dikirim backend (`is_override`) |

## Apa yang dilihat kandidat (dari kode `web/src/pages/interview/InterviewPage.tsx`)
- Sebelum mulai (`:195-209`, bahasa Inggris saja walaupun assessment `id`): judul role + 4 poin — tempat tenang, AI akan bertanya follow-up, durasi maksimal, "mic aktif sepanjang sesi, bisa berhenti kapan saja". **Tidak ada** pemberitahuan privasi, persetujuan, penjelasan bahwa audio dikirim ke Google, atau siapa yang memutuskan.
- HardwareCheck: OS/browser → kecepatan internet (download ≥ 8 Mbps, upload ≥ 4 Mbps, ping ≤ 300 ms; `web/src/utils/internetSpeedTest.ts:19-23`) → mic (kamera opsional) → speaker; tombol Start terkunci sampai semua lulus.
- Selesai (`:234-236`): "Interview Complete — Thank you. The interview has been recorded." Tidak ada info langkah berikutnya. Audio tidak disimpan di DB (hanya transkrip) — teks "recorded" perlu dicek kebenarannya.

## Temuan runtime (terverifikasi)
- **[2026-10-20] Skill duplikat → kandidat tidak pernah bisa mulai.** Form New Assessment mengirim dua skill berlabel sama dalam satu POST (L2 & L3) dan server menerimanya. `StartHandler` gagal di unique index `coverage_maps(session_id, skill_label)`; exception di `on:open` menutup WS tanpa pesan → client reconnect tanpa henti (`onopen` me-reset counter) → layar "Briefly reconnecting — please wait a moment." selamanya. Setelah 120 s grace timer mengakhiri sesi yang belum pernah mulai (`ended/error`, `started_at nil`, 0 turn) → link undangan hangus dan job portfolio tetap di-enqueue. **Diperbaiki (belum di-commit):** validasi label unik di `Assessment` (422), error `session_start_failed` non-recoverable dari server, client berhenti reconnect setelah error non-recoverable, grace timer hanya mengakhiri sesi `active`.
- **[2026-10-20] Semua error non-recoverable berakhir di layar ✅ "Interview Complete"** (`useAudioWebSocket.ts` → `onStateChange("complete")`): kandidat yang sesinya gagal mulai diberi tahu wawancaranya selesai dan "recorded". Belum ada state error untuk kandidat — keputusan UX/copy terbuka.
- **[2026-10-20] Password login tercatat plaintext di log**: `api/config/` tidak punya `filter_parameters`; `api/log/development.log` memuat `"password"=>"..."` dari `POST /api/v1/auth/login` (berlaku juga di production). Belum diperbaiki.
- **[2026-10-20] Alur suara kandidat berjalan end-to-end** (smoke dengan audio `say` 16 kHz via WS, sesi uji 5 & 6): sapaan AI → kandidat menjawab → transkripsi akurat → AI mem-probe detail spesifik jawaban (ADR webhook, trade-off) → `end_session` → `session_ended manual_candidate`. Hipotesis "audio biner tidak sampai ke Gemini" terbantah. Bahasa sesi: Inggris.
- **[2026-10-20] Coverage tidak pernah bergerak bila model FLASH mati**: analyzer 404 → skill tetap `not_yet`, wrap-up otomatis tidak pernah terpicu, dan error hanya ada di log (assessor tidak diberi tahu). Dengan `gemini-3.5-flash-lite` analyzer bekerja (`initiated` setelah 2 jawaban). Teks `last_signal` dari LLM bisa tidak konsisten dengan angka (`probe_count is 2` vs `new_probe_count 1`).
- **[2026-10-20] Alur lengkap terverifikasi di config final** (sesi uji 7): coverage live via Sidekiq `not_yet → covered` (probe 2) setelah 2 jawaban; portfolio `complete` dalam ±8 s dengan `gemini-3.5-flash`; kutipan bukti verbatim dari transkrip. Transkrip kandidat bisa salah dengar ("wet hook" untuk "webhook").
- **[2026-10-20] Output portfolio tidak stabil antar-run**: transkrip sama → level 3 konsisten, tetapi confidence `medium` lalu `low`. Hasil penilaian bergantung pada run LLM; relevan untuk keadilan kandidat dan pembelaan keputusan (pilar 3 & 5).
- **[2026-10-20] `Gemini::HttpClient` hanya membaca `parts[0]` dan tidak meminta JSON** → portfolio sesekali gagal `JSON::ParserError` (output terpotong). Diperbaiki (belum di-commit): `responseMimeType: application/json`, gabung semua part non-thought, error eksplisit saat `MAX_TOKENS`. 503 sementara dari Gemini tetap mungkin; worker portfolio retry 3×.

## Hipotesis untuk diverifikasi saat dipakai end-to-end
Urutan: jalankan app → login admin → buat assessment (en & id) → buat sesi → buka link sebagai kandidat (laptop & HP, jaringan lambat) → interview penuh, interview yang dihentikan di tengah, refresh halaman di tengah → monitor live → portfolio → override → fit/gap → export PDF & JSON → periksa DB (`ai_interview.*`) & payload API.
1. Refresh halaman kandidat di tengah sesi → sesi diakhiri ±120 s kemudian (`audio_websocket_middleware.rb:93-100,501-516`).
2. Skill yang tidak dibahas mendapat L1 dan tampil "Gap" (lihat tabel di atas).
3. Kolom "Required" fit/gap kosong; ✏ override tidak pernah tampil.
4. Speed test diblokir CSP produksi (`web/vercel.json` connect-src) → Start tidak pernah aktif di produksi.
5. Export PDF gagal bila ada override/karakter non-Latin-1 (Prawn font bawaan).
6. Endpoint portfolio/fit-gap/override dapat diakses lintas tenant (`Portfolio.find(params[:id])`, `api/app/controllers/api/v1/portfolios_controller.rb:82,104,130,156`).
7. Login: user global, scheme tenant dari header `X-Tenant-Scheme` (`api/app/controllers/api/v1/authentication_controller.rb:24-28`).
8. Batas waktu hanya dicek saat ada transkripsi; sesi hening tidak pernah berakhir sendiri.
9. Hapus skill di halaman Edit tidak menghapus di server (`_destroy` tidak dikirim).
10. Kualitas perilaku AI terhadap failure mode PRD 01 §7 (question-list behaviour, hollow affirmation, topic announcement, skip follow-up, menjawab untuk kandidat) — hanya bisa dinilai dengan GEMINI key + sesi nyata, termasuk dalam Bahasa Indonesia.
