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
