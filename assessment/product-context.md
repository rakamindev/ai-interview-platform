# Konteks Produk

## Produk ini apa

Tool interview + assessment skill yang dijalankan AI. Berdasarkan wiki produk
(PRD-01 "First Principles" dan PRD-02 "Real Simulation"):

- Assessor bikin definisi role, budget waktu, dan daftar skill dengan level
  kompetensi yang diharapkan (L1–L5, anchor bisa custom).
- Kandidat masuk sesi live; model Gemini Live jalanin interview suara realtime —
  probing, bukan baca daftar pertanyaan tetap.
- "Coverage map" nge-track, per skill, state-nya (`not_yet → initiated →
  partial → covered`, atau `discovered` buat skill di luar rencana) dan jumlah
  probe. Proses background Gemini Flash update ini tiap habis giliran kandidat
  ngomong.
- Setelah sesi selesai, Gemini Pro ubah full transcript + coverage map jadi
  portfolio: rating L1–L5 per skill, tingkat confidence (high/medium/low
  ngikutin kedalaman probe), kutipan bukti (evidence quotes), dan narasi.
- Assessor dapat matriks fit/gap (level yang dibutuhin vs level kandidat) dan
  laporan PDF yang bisa di-export.

Jadi nilai jual produk ini sebenarnya **menggantikan penilaian interviewer
teknis manusia dengan AI, secara skala besar** — bukan sekadar transkripsi
atau penjadwalan. Itu standar yang jauh lebih tinggi dibanding kebanyakan tool
"AI interview" di pasaran, dan di situ juga risikonya numpuk: salah nge-call
L1 vs L4 bukan bug UI, itu keputusan hiring.

## Industri: hiring & assessment di Indonesia

- Volume hiring (rekrutmen kampus, BPO, sales, lulusan bootcamp) adalah titik
  paling sakit buat recruiter Indonesia — kandidat kebanyakan, waktu
  interviewer senior gak cukup. Segmen ini paling jelas ROI-nya buat AI
  interviewer tahap awal: dia jadi layer triase/screening, bukan (belum)
  pengganti keputusan final manusia.
- Yang udah komoditas: parsing resume/ATS, penjadwalan, tes psikometri (DISC,
  kognitif), interview video async yang direview manusia belakangan. Semua itu
  gak benar-benar nilai kedalaman teknis secara realtime.
- Di mana leverage sebenarnya: **sinyal teknis yang terstruktur, bisa
  dipertanggungjawabkan, dan bisa dibandingkan, di ujung atas funnel**,
  dihasilkan cukup cepat sampai recruiter bisa triase 50 kandidat dalam waktu
  yang dulu cuma cukup buat interview 5 orang. Diferensiator-nya bukan "AI
  yang nanya," tapi desain coverage-map + evidence-quote — assessor bisa audit
  *kenapa* kandidat dapet L3, bukan cuma lihat angkanya. Kemampuan diaudit itu
  yang jadi produk sebenarnya; skor telanjang gak bisa dipertanggungjawabkan
  kalau ada sengketa atau tantangan hukum.
- Kendala khusus Indonesia: keputusan hiring bisa digugat (sengketa
  ketenagakerjaan, klaim diskriminasi), jadi "kata AI L2" tanpa bukti itu
  liabilitas, bukan cuma gap UX.

## Apa yang harus tetap benar biar produk ini tetap berguna

1. **Skor harus cukup dipercaya sampai manusia mau bertindak berdasarkan itu
   tanpa ngulang kerjaannya sendiri.** Kalau assessor jadi gak percaya rating
   (misal, nge-rate skill yang gak pernah ditanyain, atau crash diam-diam dan
   nunjukin skor basi/nol), mereka bakal interview ulang semua orang secara
   manual dan seluruh nilai jual produk — hemat waktu — hilang.
2. **AI harus gagal secara jelas, bukan diam-diam.** Timeout model yang
   hasilnya rating skill kosong atau nol gak bisa dibedain, di UI, dari
   kandidat yang emang skornya L1. Itu dua hasil yang bedanya jauh banget buat
   kandidat, dan gak boleh kelihatan sama.
3. **Setup-nya harus tetap cepat.** Kalau konfigurasi assessment (nentuin
   skill, anchor) makan waktu selama nulis pertanyaan manual, assessor gak
   bakal repot pakai.
4. **Harus bisa jangkau lebih dari perusahaan besar yang punya recruiter
   dedicated** biar beneran berdampak di skala hiring Indonesia — UKM dan
   program rekrutmen kampus, yang paling kekurangan waktu interviewer, paling
   diuntungkan tapi paling gak mampu nanggung tool black-box dengan posisi
   compliance yang gak jelas.

## Pengguna: assessor, recruiter, hiring manager

- **Assessor** (biasanya hiring manager atau IC senior di domain role
  tersebut): nentuin daftar skill, mungkin mantau sesi live, baca portfolio
  belakangan, ambil keputusan go/no-go atau shortlist. Harinya kepecah ke
  banyak kandidat; mereka butuh skim laporan dan percaya evidence quote tanpa
  harus dengerin ulang audio 45 menit per kandidat.
- **Recruiter**: kelola funnel, jadwalin sesi, bandingin kandidat lintas role.
  Peduli soal konsistensi perbandingan — kandidat buat role yang sama harus
  diprobe dengan ketat yang sama biar bisa dibandingin, dan itu persis yang
  "confidence" berdasarkan kedalaman probe coba jamin.
- **Hiring manager**: sering jadi pengambil keputusan final, kadang cuma lihat
  matriks fit/gap dan narasi, gak lihat transcript mentah. Buat mereka,
  ringkasan *itulah* interview-nya — kalau ringkasan salah gambarkan yang
  terjadi, mereka gak bakal pernah tau.

Gak satupun dari user ini evaluator teknis buat AI-nya sendiri — mereka gak
bakal nyadar ada bug scoring yang halus, cuma nyadar hasil yang "kerasa aneh"
belakangan (kalau nyadar sama sekali). Itu bikin kebenaran pipeline scoring
jadi concern P0-by-default: error di situ gak kelihatan buat orang-orang yang
ngandelin hasilnya.

## Orang yang kena dampak tapi gak pernah milih: kandidat

- Kandidat gak milih dinilai AI interviewer alih-alih manusia — perusahaan
  yang milih. Mereka gak bisa opt-out tanpa kehilangan kesempatan kerja, dan
  gak punya visibilitas (atau jalur keberatan) atas salah nge-call L1 vs L3.
  WebSocket putus, Gemini Live down di tengah pertanyaan, atau generasi
  portfolio gagal, bukan cuma nurunin UX buat mereka — bisa nutup peluang
  kerja mereka tanpa ada tanda apapun kalau yang salah itu sistemnya.
- Bahaya konkret yang harus dirancang buat dihindari:
  - Sesi/audio gagal di tengah interview ditafsirkan sebagai kandidat diam
    (sinyal kompetensi beneran) padahal itu error teknis.
  - Skill yang sebenarnya gak pernah diprobe (`not_yet`/`initiated`) muncul di
    portfolio sebagai skor numerik rendah, bukan "belum dinilai" — masalah
    silent-zero yang gak adil nurunin skor kandidat yang emang gak pernah
    ditanyain.
  - Jawaban panjang dan nuansanya ilang kepotong pas nyimpen transcript atau
    generate portfolio, ngilangin bukti yang harusnya bikin skor lebih tinggi.
  - Job Sidekiq yang di-retry/dobel ngejalanin ulang generasi portfolio dan
    hasilin rating beda dari transcript yang sama, tanpa ada catatan keputusan
    diambil berdasarkan yang mana.

### UU PDP (Undang-Undang Perlindungan Data Pribadi)

Platform ini nyimpen audio interview, transcript lengkap, dan penilaian
kompetensi hasil AI soal individu bernama jelas — jelas "data pribadi", dan
transcript/audio-nya bahkan mepet ke data sensitif karena bisa ungkap hal
kayak aksen, pola bicara terkait disabilitas, atau info kesehatan yang
kesebut gak sengaja.

Implikasi yang perlu dibawa ke gap analysis dan desain revamp:

- **Batasan tujuan & retensi**: transcript/audio/skor harus punya periode
  retensi jelas dan jalur hapus, gak numpuk selamanya lintas tenant.
- **Minimalisasi data di log**: teks transcript, payload audio, atau PII
  (nama, email) gak boleh masuk log aplikasi/Sidekiq atau breadcrumb error
  tracking — ini juga disqualifier eksplisit di brief kalau secret/PII sampai
  masuk log atau commit.
- **Isolasi tenant**: dengan multi-tenancy di data model, bug yang bocorin
  tenant-scoping (nampilin data kandidat tenant lain) itu insiden UU PDP,
  bukan sekadar bug — ini perlu diverifikasi, bukan diasumsikan, di tiap
  action controller.
- **Desain semi-hak-atas-penjelasan**: karena rating AI ngedorong keputusan
  hiring beneran, ngejaga evidence quote dan confidence tier tetap utuh
  (bukan diringkes jadi angka doang) itu yang bikin skor kandidat bisa
  dipertanyakan/dijelasin belakangan — properti yang ramah UU PDP dan udah
  condong ke situ di spec produk, dan implementasinya gak boleh ngerusak itu.
