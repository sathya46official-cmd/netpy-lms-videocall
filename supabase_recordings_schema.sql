-- ============================================================
-- Recordings Table
-- Run this in Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS recordings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id          UUID REFERENCES meetings(id) ON DELETE CASCADE,
  org_id              UUID REFERENCES organisations(id) ON DELETE CASCADE,
  host_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  stream_recording_id TEXT,
  file_key            TEXT NOT NULL,        -- MinIO object key e.g. "org-id/meeting-id/rec.mp4"
  duration_seconds    INTEGER,
  status              TEXT DEFAULT 'ready'  -- ready | processing | failed
    CHECK (status IN ('ready', 'processing', 'failed')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by meeting
CREATE INDEX IF NOT EXISTS recordings_meeting_id_idx ON recordings(meeting_id);

-- Index for org-scoped queries
CREATE INDEX IF NOT EXISTS recordings_org_id_idx ON recordings(org_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Super admins can view everything
CREATE POLICY "super_admin can view all recordings"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Org admins can view everything in their organisation
CREATE POLICY "org_admin can view organisation recordings"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'org_admin'
        AND users.org_id = recordings.org_id
    )
  );

-- Staff and students can only view recordings for meetings they were invited to or hosted
CREATE POLICY "invited members can view recordings"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = recordings.org_id
        AND users.role IN ('staff', 'student')
        AND (
          recordings.host_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM meeting_invites mi
            WHERE mi.meeting_id = recordings.meeting_id
              AND (
                mi.user_id = auth.uid() OR
                EXISTS (
                  SELECT 1 FROM batch_members bm
                  WHERE bm.batch_id = mi.batch_id
                    AND bm.user_id = auth.uid()
                )
              )
          )
        )
    )
  );

-- Only service role (webhooks/admin) can insert recordings
CREATE POLICY "service role can insert recordings"
  ON recordings FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
