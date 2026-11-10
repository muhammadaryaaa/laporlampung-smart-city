# LaporLampung — Smart City Kota Bandar Lampung

Aplikasi pelaporan infrastruktur dan fasilitas publik Kota Bandar Lampung.
Ujian Tengah Semester — Proyek Pengembangan Sistem Informasi
Universitas Teknokrat Indonesia

- Nama: Muhammad Arya Putra
- NPM: 24311121
- Kelas: SI 24 A
- Dosen: Dr. Erliyan Redy Susanto, M.Kom

## Cara Menjalankan Demo (Frontend)

Buka folder `app/` sebagai situs statis, contoh:

```bash
cd app
python3 -m http.server 8000
# buka http://localhost:8000
```

Akun demo:
- Warga: warga@laporlampung.id / Warga123!
- Admin Pemda: admin@laporlampung.id / Admin123!

## Backend Rust + PostgreSQL (Produksi)

```bash
cd backend-rust
cp .env.example .env   # isi DATABASE_URL dan JWT_SECRET (min. 32 karakter)
cargo audit            # SEC-09: audit dependency sebelum rilis
cargo run              # API berjalan di :8080, migration sqlx berjalan otomatis
```

Database: PostgreSQL. Migrasi: `backend-rust/migrations/001_create_tables.sql`
(Neon PostgreSQL cloud untuk produksi.)

## Deployment Vercel

Import repository ini di Vercel, set **Root Directory = app**,
Framework Preset = Other, tanpa Build Command. File `app/vercel.json`
sudah memuat security headers (CSP, X-Frame-Options, dll).

## Struktur

- `app/` — frontend statis (HTML/CSS/JS) untuk Vercel
- `backend-rust/` — API Rust Axum + sqlx PostgreSQL
- `docs/` — dokumen UTS Soal 1–4, 6–10

## Desain — Google Stitch (v2.0)

Antarmuka versi 2.0 dirancang dengan **Google Stitch**, project
"LaporLampung Citizen Reporting App":
https://stitch.withgoogle.com/projects/11599614112696964278
(6 screens: Dashboard, Daftar Laporan, Detail Laporan, Buat Laporan,
Masuk, dan design-system board — Material Design 3, Primary #0B5FA5,
Navy #083D6B, Gold #F2B705, Inter, kartu radius 16px.)

## Footer

Copyright©2026 by Muhammad Arya Putra dan Dr. Erliyan Redy Susanto, M.Kom

Logo: file logo persis yang diberikan pemilik proyek — Lambang Provinsi
Lampung (Pemda) dan Logo Universitas Teknokrat Indonesia — tertanam
langsung di `app/index.html` (data URI, dari file asli di
`app/assets/logo-pemda-full.png` dan `logo-teknokrat-full.png`).
