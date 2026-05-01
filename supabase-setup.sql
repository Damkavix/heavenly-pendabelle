-- Coller ce SQL dans : Supabase Dashboard → SQL Editor → New query → Run

CREATE TABLE orders (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT        NOT NULL,
  customer_phone TEXT       NOT NULL,
  products      TEXT[]      NOT NULL,
  quantity      INTEGER     DEFAULT 1,
  delivery_mode TEXT        NOT NULL DEFAULT 'Livraison à domicile',
  address       TEXT        DEFAULT '',
  status        TEXT        DEFAULT 'nouveau',
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sécurité : n'importe qui peut insérer (formulaire public),
-- seul le service_role (backend) peut lire et modifier.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert"
  ON orders FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "service_all"
  ON orders FOR ALL TO service_role
  USING (true);
