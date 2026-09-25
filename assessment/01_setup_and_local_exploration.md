# Step 1: Setup & Local Exploration

## 1. System Overview & Architecture

Platform ini adalah **AI Interview Platform** (Rakamin), sebuah sistem interview kerja berbasis percakapan suara (*live audio stream*) yang ditenagai oleh Google Gemini Live API.

Arsitektur terdiri dari dua komponen utama:
- **Backend (`api/`)**:
  - **Framework**: Ruby on Rails 7 (API mode).
  - **Server**: Puma (port `3001`).
  - **Database**: PostgreSQL 16 (skema `ai_interview` dan `public.organizations`).
  - **Cache & Message Broker**: Redis 7.
  - **Background Worker**: Sidekiq 7 (audio processing, portfolio generation, fit/gap analysis).
  - **WebSocket / EventMachine**: Faye-WebSocket untuk real-time audio bidirectional streaming.
- **Frontend (`web/`)**:
  - **Framework**: React 18 + Vite 6 + TypeScript.
  - **UI & Styling**: Tailwind CSS + Radix UI + Lucide Icons.
  - **State Management**: Jotai atoms.
  - **Port**: `5173`.

---

## 2. Status Layanan Saat Ini (Running Services)

Semua layanan telah diinisialisasi dan saat ini sedang aktif:

| Service | Host / Port | Status | Keterangan |
|---|---|---|---|
| **PostgreSQL** | `localhost:5432` | **Healthy** (Docker) | Database `rakamin_development` sudah di-migrate & seed (22 skills B7 & Org Test Corp) |
| **Redis** | `localhost:6379` | **Healthy** (Docker) | Background queue & WebSocket broker |
| **Rails API** | `http://localhost:3001` | **Healthy / Running** (Docker) | Endpoint `/api/v1/health` mengembalikan `200 OK` |
| **Sidekiq** | Background | **Running** (Docker) | Worker aktif siap memproses job antrean |
| **Frontend Web** | `http://localhost:5173` | **Running** (Vite) | UI siap dibuka di browser |

---

## 3. Cara Menjalankan & Menghentikan Project (Docker & Frontend)

Seluruh dependensi backend berjalan di dalam container Docker Compose:

### 1. Menjalankan Backend (Database, Redis, Rails API, Sidekiq)
Jalankan perintah berikut di root project:
```bash
docker compose up -d
```

Untuk memverifikasi bahwa semua container berjalan dengan baik:
```bash
docker compose ps
```

Untuk melihat live logs service API:
```bash
docker compose logs -f api
```

### 2. Menjalankan Frontend
Masuk ke direktori `web` dan jalankan Vite dev server:
```bash
cd web
npm run dev
```
Buka `http://localhost:5173` di browser.

### 3. Menghentikan Backend
Untuk mematikan seluruh container backend:
```bash
docker compose down
```

Jika ingin me-restart salah satu service (misalnya API):
```bash
docker compose restart api
```
