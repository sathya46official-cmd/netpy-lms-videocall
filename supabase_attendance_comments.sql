-- ============================================================
-- LMS Video Platform Updates: Attendance, Progress, Comments
-- Analytics and Interactive features
-- ============================================================

-- 1. Meeting Attendance Tracking (Live Sessions)
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    duration_seconds integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Index for querying analytics
CREATE INDEX IF NOT EXISTS attendance_meeting_idx ON public.meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS attendance_user_idx ON public.meeting_attendance(user_id);

-- 2. Recording Progress Tracking (VOD)
CREATE TABLE IF NOT EXISTS public.recording_progress (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id uuid REFERENCES public.recordings(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    watched_seconds integer DEFAULT 0,
    last_position_seconds integer DEFAULT 0,
    completed boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(recording_id, user_id)
);

-- 3. Recording Comments (YouTube Style)
CREATE TABLE IF NOT EXISTS public.recording_comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id uuid REFERENCES public.recordings(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    parent_id uuid REFERENCES public.recording_comments(id) ON DELETE CASCADE, -- For replies
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS Policies

ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_comments ENABLE ROW LEVEL SECURITY;

-- Analytics can be read by admins or staff
CREATE POLICY "Staff can read attendance" ON public.meeting_attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'org_admin', 'staff'))
);

CREATE POLICY "Users can see their own attendance" ON public.meeting_attendance FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY "System can insert attendance" ON public.meeting_attendance FOR ALL USING (
  auth.role() = 'service_role'
);

-- Progress
CREATE POLICY "Users can manage their own progress" ON public.recording_progress FOR ALL USING (
  user_id = auth.uid()
);
CREATE POLICY "Staff can view student progress" ON public.recording_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'org_admin', 'staff'))
);

-- Comments
CREATE POLICY "Anyone can view comments" ON public.recording_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.recording_comments FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);
CREATE POLICY "Users can update their own comments" ON public.recording_comments FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "Users can delete their own comments" ON public.recording_comments FOR DELETE USING (
  user_id = auth.uid()
);
