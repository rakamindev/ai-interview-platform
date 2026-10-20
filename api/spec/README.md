# Test suite

## Menjalankan

```bash
bundle exec rspec                                      # seluruh suite
bundle exec rspec spec/services                        # satu folder
bundle exec rspec spec/services/coverage/state_engine_spec.rb:17   # satu contoh
```

Postgres dan Redis harus sudah jalan:

```bash
docker start pg redis
```

`config/application.yml` (Figaro) menyediakan `SECRET_KEY_BASE`, kredensial database,
dan kunci Gemini, jadi tidak ada variabel lingkungan tambahan yang dibutuhkan.

## Layout

```
spec/
├── spec_helper.rb          config RSpec
├── rails_helper.rb         env Rails, Rack::Attack mati, load spec/support
├── factories/              pembangun data uji
├── support/tenant_helpers.rb   state tenant + header JWT
├── models/                 validasi dan perilaku
├── services/               logika bisnis
└── requests/               seluruh stack: routing, middleware, DB, auth
```

## Tiga hal yang perlu diingat

**Rack::Attack dimatikan di `rails_helper.rb`.** API membatasi `POST /auth/login`
5 kali per menit per IP dan menghitungnya di Redis. Tanpa baris itu, request spec
berakhir 429 atau menggantung — bukan karena bug yang sedang diuji.

**Spec tidak boleh memanggil Gemini.** Layanan yang bicara ke model menerima
argumen opsional `gemini_client:`. Seam itu ada supaya bisa dipasangi double.
Lihat `Coverage::Analyzer`, `FitGap::Engine`, `Portfolios::Generator`.

**`ai_interview` bukan schema bawaan.** Kalau tabel tidak ada, `db:schema:load`
diam-diam membuat semuanya di `public` dan spec pertama gagal dengan
`relation does not exist`. Buat schema-nya dulu:

```bash
psql -h localhost -U postgres -d rakamin_test -c 'CREATE SCHEMA IF NOT EXISTS ai_interview;'
RAILS_ENV=test bundle exec rails db:schema:load
```
