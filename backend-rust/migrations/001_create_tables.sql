-- LaporLampung Migration 001 - PostgreSQL
-- SEC-02: all application queries MUST use bound parameters ($1, $2, ...)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('warga','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('Baru','Diverifikasi','Diproses','Selesai','Ditolak'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_priority AS ENUM ('Rendah','Sedang','Tinggi','Darurat'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- Argon2id hash only, never plain text (SEC-01)
  role user_role NOT NULL DEFAULT 'warga',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id INT NOT NULL REFERENCES categories(id),
  title VARCHAR(100) NOT NULL CHECK (char_length(title) >= 10),
  district VARCHAR(60) NOT NULL,
  location VARCHAR(150) NOT NULL,
  description VARCHAR(500) NOT NULL CHECK (char_length(description) >= 20),
  priority report_priority NOT NULL DEFAULT 'Sedang',
  status report_status NOT NULL DEFAULT 'Baru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_district ON reports(district);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_id);
CREATE TABLE IF NOT EXISTS report_status_history (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES users(id),
  old_status report_status, new_status report_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  body VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO categories(name) VALUES
 ('Jalan Rusak'),('Lampu Jalan'),('Sampah & Kebersihan'),('Drainase & Banjir'),
 ('Fasilitas Publik'),('Taman & Ruang Publik'),('Lalu Lintas'),('Air Bersih')
ON CONFLICT (name) DO NOTHING;
