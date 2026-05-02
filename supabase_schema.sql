-- =============================================
-- ASSET TRACKER v2 — Supabase Schema
-- Jalankan di: Supabase Dashboard → SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS bibit_assets (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nama_aset  TEXT NOT NULL,
  kategori   TEXT NOT NULL DEFAULT 'pasar_uang',
  saldo      NUMERIC(18,2) NOT NULL DEFAULT 0,
  aktual     NUMERIC(18,2) NOT NULL DEFAULT 0,
  catatan    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS binance_assets (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol     TEXT NOT NULL,
  saldo      NUMERIC(18,2) NOT NULL DEFAULT 0,
  aktual     NUMERIC(18,2) NOT NULL DEFAULT 0,
  catatan    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS physical_assets (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset_name TEXT NOT NULL,
  buy_price  NUMERIC(18,2) NOT NULL DEFAULT 0,
  buy_date   DATE NOT NULL,
  kategori   TEXT,
  catatan    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liquid_assets (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nama       TEXT NOT NULL,
  jumlah     NUMERIC(18,2) NOT NULL DEFAULT 0,
  catatan    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jht_assets (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  jumlah     NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_goals (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_amount  NUMERIC(18,2) NOT NULL DEFAULT 200000000,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tab_configs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'custom',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE bibit_assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE binance_assets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquid_assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jht_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tab_configs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON bibit_assets    FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON binance_assets  FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON physical_assets FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON liquid_assets   FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON jht_assets      FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON financial_goals FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON tab_configs     FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t1 BEFORE UPDATE ON bibit_assets    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t2 BEFORE UPDATE ON binance_assets  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t3 BEFORE UPDATE ON physical_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER t4 BEFORE UPDATE ON liquid_assets   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- MODULE TABLES (Service, Itinerary, Hiking)
-- =============================================

CREATE TABLE IF NOT EXISTS vehicles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'motor',
  plate        TEXT,
  year         INTEGER,
  km_current   INTEGER NOT NULL DEFAULT 0,
  parts_config JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_records (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vehicle_id     UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date   DATE NOT NULL,
  km_at_service  INTEGER,
  service_type   TEXT NOT NULL,
  product_used   TEXT,
  shop           TEXT,
  cost           INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  destination           TEXT NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  people_count          INTEGER NOT NULL DEFAULT 1,
  est_budget_per_person NUMERIC(18,2) NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'upcoming',
  itinerary             JSONB,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hikes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mountain   TEXT NOT NULL,
  elevation  INTEGER,
  city       TEXT,
  start_date DATE NOT NULL,
  end_date   DATE,
  route      TEXT,
  status     TEXT NOT NULL DEFAULT 'summit',
  members    INTEGER NOT NULL DEFAULT 1,
  photos_url TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE vehicles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE hikes            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON vehicles        FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON service_records FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON trips            FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON hikes            FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =============================================
-- MIGRATION: add columns to existing tables
-- Run if tables already exist (safe to re-run)
-- =============================================

ALTER TABLE vehicles        ADD COLUMN IF NOT EXISTS type         TEXT NOT NULL DEFAULT 'motor';
ALTER TABLE vehicles        ADD COLUMN IF NOT EXISTS parts_config JSONB;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS product_used TEXT;
ALTER TABLE hikes            ADD COLUMN IF NOT EXISTS city         TEXT;
ALTER TABLE hikes            ADD COLUMN IF NOT EXISTS photos_url   TEXT;

-- =============================================
-- WEDDING PLANNER TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS wedding_budget_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category   TEXT NOT NULL,
  vendor     TEXT NOT NULL,
  budget_max NUMERIC(18,2) NOT NULL DEFAULT 0,
  estimate   NUMERIC(18,2),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wedding_transactions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  budget_item_id UUID REFERENCES wedding_budget_items(id) ON DELETE CASCADE NOT NULL,
  category       TEXT NOT NULL DEFAULT '',
  amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
  type           TEXT NOT NULL DEFAULT 'DP',
  date           DATE NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wedding_budget_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_transactions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own" ON wedding_budget_items;
DROP POLICY IF EXISTS "own" ON wedding_transactions;

CREATE POLICY "own" ON wedding_budget_items  FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own" ON wedding_transactions  FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =============================================
-- WEDDING PLANNER v2 — Vendor & Settings
-- =============================================

-- Vendor master list
CREATE TABLE IF NOT EXISTS wedding_vendors (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  price_estimate NUMERIC(18,2),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wedding_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own" ON wedding_vendors;
CREATE POLICY "own" ON wedding_vendors FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Global wedding settings (total budget)
CREATE TABLE IF NOT EXISTS wedding_settings (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_budget NUMERIC(18,2) DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wedding_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own" ON wedding_settings;
CREATE POLICY "own" ON wedding_settings FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Add vendor_id column to budget items (run once)
ALTER TABLE wedding_budget_items ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES wedding_vendors(id) ON DELETE SET NULL;
