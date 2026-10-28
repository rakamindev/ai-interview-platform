# AI Interview Platform

An end-to-end AI-powered technical interview and automated competency assessment platform. Built with a decoupled architecture featuring a Ruby on Rails backend and a modern React (TypeScript) frontend, integrated with Google Gemini AI for real-time bidirectional voice interviews and structured portfolio generation.

[![CI](https://github.com/Deleonwira/ai-interview-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Deleonwira/ai-interview-platform/actions/workflows/ci.yml)

---

## Architecture Overview

The platform consists of two core services communicating via REST APIs and WebSockets:

```
.
├── api/          # Backend API (Ruby on Rails 7, PostgreSQL, Redis, Sidekiq)
├── web/          # Frontend Web App (React 18, TypeScript, Vite, Tailwind CSS, Radix UI)
└── .github/      # Continuous Integration workflows (GitHub Actions)
```

```
                        ┌──────────────────────────────────────────────┐
                        │             React 18 Frontend                │
                        │    (Hardware Check, Live Audio, Portfolio)   │
                        └──────────────┬───────────────────────────────┘
                                       │
                      REST API (3001)  │  WebSocket (Audio Stream)
                                       ▼
                        ┌──────────────────────────────────────────────┐
                        │            Rails 7 Backend API               │
                        │  (Auth, Sessions, AudioWebSocketMiddleware)  │
                        └──────┬───────────────────┬───────────────────┘
                               │                   │
                 Sidekiq Jobs  │                   │ Bidirectional Audio /
           (Portfolio / FitGap)│                   │ Content Generation
                               ▼                   ▼
                     ┌──────────────────┐    ┌───────────────────────────┐
                     │ PostgreSQL/Redis │    │     Google Gemini AI      │
                     │  (Storage/Queue) │    │(Live 3.1 & Flash 3.5 Text)│
                     └──────────────────┘    └───────────────────────────┘
```

---

## Key Engineering & Product Improvements (Monozukuri)

### 1. Robust Native WebSocket Client for Windows (`api/app/clients/gemini/ssl_web_socket_client.rb`)
* **Problem**: Standard `faye-websocket` / EventMachine raised `Errno::ENOTSOCK` on Windows Winsock implementations, causing live interview audio handshakes to drop instantly.
* **Solution**: Implemented a pure Ruby OpenSSL WebSocket client via `websocket-driver` with non-blocking I/O (`read_nonblock` + `IO.select`) and deadlock-free synchronization.

### 2. Gemini Model Lifecycle & Endpoint Upgrade
* **Problem**: Deprecated models (`gemini-2.0-flash-live-001`, `gemini-2.0-pro-001`) and legacy `/v1` endpoints returned HTTP 400/404 errors during live sessions and post-interview portfolio generation.
* **Solution**: Upgraded Live audio streaming to `gemini-3.1-flash-live-preview` and HTTP evaluation endpoints to `/v1beta` with `gemini-3.5-flash`, ensuring consistent generation of competencies and evidence quotes.

### 3. Fair Candidate Hardware Pre-check (`web/src/utils/internetSpeedTest.ts`)
* **Problem**: Rigid upload speed threshold (4.0 Mbps) caused false-negative rejections for candidates with asymmetric home internet in Indonesia, even though audio streaming only requires ~256 kbps.
* **Solution**: Adjusted minimum upload threshold to `0.2 Mbps` (200 kbps) while maintaining strict download (8 Mbps) and latency checks (<= 300 ms).

### 4. Cross-Platform Runtime Support (`puma.rb`, `inflections.rb`)
* Disabled multi-process worker mode in Puma when running on Windows (where `fork()` is unsupported).
* Registered `WebSocket` acronym inflection to resolve Zeitwerk autoloading conventions.

---

## Getting Started (Local Development)

### Prerequisites
* **Ruby**: 3.3.2 (with Bundler)
* **Node.js**: v20+ & npm
* **PostgreSQL**: 14+ running locally (default user: `postgres`, password: `123`)
* **Redis**: running on `localhost:6379`
* **Google Gemini API Key**: from [Google AI Studio](https://aistudio.google.com/)

---

### 1. Backend Setup (`api/`)

1. Navigate to the API directory:
   ```bash
   cd api
   ```
2. Install dependencies:
   ```bash
   bundle install
   ```
3. Configure environment:
   ```bash
   # Copy sample configuration
   cp config/application.yml.sample config/application.yml
   ```
   Edit `config/application.yml` and provide your `GEMINI_API_KEY`:
   ```yaml
   GEMINI_API_KEY: "your_gemini_api_key_here"
   GEMINI_LIVE_MODEL: "gemini-3.1-flash-live-preview"
   GEMINI_FLASH_MODEL: "gemini-3.5-flash"
   GEMINI_PRO_MODEL: "gemini-3.5-flash"
   ```
4. Prepare database and seeds:
   ```bash
   bundle exec rails db:create db:migrate db:seed
   ```
5. Start the background job processor (Sidekiq):
   ```bash
   bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
   ```
6. In a separate terminal, start the Rails server (Port 3001):
   ```bash
   bundle exec rails server -p 3001
   ```

---

### 2. Frontend Setup (`web/`)

1. Navigate to the Web directory:
   ```bash
   cd web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Ensure `.env` matches the backend:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api/v1
   VITE_WS_BASE_URL=ws://localhost:3001
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Automated Testing & CI

Both services include automated test suites verified by GitHub Actions CI on every push and pull request.

### Running Backend Tests (RSpec)
```bash
cd api
bundle exec rspec
```
*Coverage*: Gemini HTTP client, endpoint routing, error handling (400/429/timeout), and `Portfolios::Generator` skill persistence.

### Running Frontend Tests (Vitest)
```bash
cd web
npm test
```
*Coverage*: Internet speed thresholds and candidate hardware test evaluation logic.

---

## License

This project is part of a Product Engineer technical case study assessment.
