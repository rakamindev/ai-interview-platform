# Step 3: Defining Problem and Gap to Ideal Condition

## 3.1 Problem Definition & Gap Analysis
Berdasarkan tinjauan alur sistem secara *end-to-end*, terdapat kesenjangan (*gap*) antara alur kerja aplikasi saat ini dengan praktik umum proses rekrutmen di Indonesia:

* **Current State (Candidate-Centric)**:
  Kandidat menyelesaikan asesmen wawancara AI terlebih dahulu sebelum dikaitkan dengan lowongan tertentu. Setelah itu, *recruiter* harus melakukan pencocokan manual (*matching*) antara profil kandidat dengan lowongan yang tersedia. Proses ini membutuhkan beban kerja manual tambahan seiring bertambahnya jumlah kandidat.

* **Ideal State (Vacancy-Centric)**:
  Alur rekrutmen idealnya berpusat pada lowongan (*vacancy-centric*). *Recruiter* mempublikasikan lowongan beserta persyaratannya, menghasilkan tautan asesmen spesifik untuk posisi tersebut, dan mengevaluasi kandidat langsung terhadap kualifikasi lowongan. AI membantu menyesuaikan pertanyaan wawancara dan merekomendasikan kandidat yang paling sesuai.

---

## 3.2 Findings List

Berikut daftar temuan masalah (*bugs* dan *vulnerabilities*) yang diidentifikasi selama pengujian aplikasi:

| ID | Finding | Current Condition | Severity |
| :--- | :--- | :--- | :---: |
| **F-1** | Candidates from one tenant can access portfolios belonging to another tenant | Isolasi multi-tenant tidak diterapkan dengan ketat, memungkinkan pengguna dari satu tenant mengakses portfolio kandidat milik tenant lain. | **P0** |
| **F-2** | Invitation links point to the backend API URL instead of the frontend application URL | Tautan undangan wawancara menggunakan konfigurasi base URL backend API alih-alih URL aplikasi web frontend, sehingga kandidat gagal mengakses halaman antarmuka wawancara. | **P0** |
| **F-3** | Starting an interview consistently fails because the configured Gemini AI model is deprecated | Model Gemini AI yang terkonfigurasi sudah usang (*deprecated*), menyebabkan inisialisasi sesi wawancara AI selalu gagal. | **P0** |
| **F-4** | Portfolio generation fails due to the same deprecated Gemini AI model configuration | Pembuatan ringkasan portfolio kandidat gagal karena menggunakan konfigurasi model Gemini yang sudah *deprecated*. | **P1** |
| **F-5** | Successful login redirects users back to the login page because the organization lookup targets the wrong schema/table | Pencarian organisasi mengarah ke skema/tabel yang salah, menyebabkan pengguna yang berhasil login terus ter-redirect kembali ke halaman login. | **P0** |
| **F-6** | Required fields are not displayed on the Fit & Gap page due to a mismatch between the frontend and backend API contracts | Informasi wajib tidak muncul pada halaman Fit & Gap akibat ketidaksesuaian kontrak data antara API backend dan frontend. | **P1** |
| **F-7** | Internet connectivity check during hardware checking takes too long and prevents candidates from starting the interview when it fails | Pemeriksaan koneksi internet saat *hardware check* memakan waktu terlalu lama atau gagal, menghalangi kandidat masuk ke ruang wawancara. | **P2** |
| **F-8** | AI chat does not automatically scroll to the latest message during the interview | Transkrip percakapan tidak melakukan auto-scroll saat ada pesan baru, sehingga pengguna harus melakukan scroll manual ke bawah. | **P3** |
| **F-9** | Internal skill coverage map metadata leaks into AI interview transcripts | Objek JSON metadata evaluasi internal (`{ "skills": [...], "discovered": [] }`) ikut terpapar dan ditampilkan di balon chat transkrip AI. | **P1** |
| **F-10** | Exporting portfolio / Fit & Gap report to PDF fails with HTTP 500 due to character encoding incompatibility | Pustaka PDF Prawn menggunakan font default AFM (*Helvetica*) yang terbatas pada Windows-1252. Saat terdapat *assessor override* (karakter panah `→`) atau karakter Unicode pada narasi AI, ekspor PDF mengalami crash `IncompatibleStringEncoding`. | **P1** |
