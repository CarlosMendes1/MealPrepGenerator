CREATE TABLE consultations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name      text,                          -- fallback if client_id is null (external client)
  scheduled_at     timestamptz NOT NULL,
  duration_min     int NOT NULL DEFAULT 60,
  type             text NOT NULL DEFAULT 'video', -- 'video' | 'whatsapp' | 'in_person'
  meeting_link     text,                          -- URL for video; wa.me link for whatsapp; null for in_person
  status           text NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutritionist_owns_consultations"
  ON consultations FOR ALL
  USING (nutritionist_id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_consultations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_consultations_updated_at();

-- Indexes
CREATE INDEX idx_consultations_nutritionist ON consultations(nutritionist_id);
CREATE INDEX idx_consultations_scheduled    ON consultations(nutritionist_id, scheduled_at);
