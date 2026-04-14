import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/recordings/sync
 * 
 * Manually pulls recordings from Stream Cloud and saves any new ones
 * into the Supabase database. This bypasses the webhook flow and is
 * safe to call multiple times (idempotent).
 *
 * Only Staff, Org Admins, and Super Admins can trigger a sync.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role === 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const streamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const streamSecret = process.env.STREAM_API_SECRET;

    if (!streamApiKey || !streamSecret) {
      console.error('Recording sync failed: Missing Stream API credentials');
      return NextResponse.json({ error: 'Stream credentials not configured' }, { status: 500 });
    }

    const streamClient = new StreamClient(streamApiKey, streamSecret, { timeout: 30000 });
    const adminDb = createAdminClient();

    // Fetch last 20 calls from Stream
    const { calls } = await streamClient.video.queryCalls({
      sort: [{ field: 'created_at', direction: -1 }],
      limit: 20,
    });

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const callState of calls) {
      const callId = callState.call.id;

      let recordings;
      try {
        const res = await streamClient.video.call('default', callId).listRecordings();
        recordings = res.recordings || [];
      } catch (recListErr) {
        console.error(`[Sync] Failed to list recordings for call ${callId}:`, recListErr);
        continue;
      }

      if (recordings.length === 0) continue;

      // Find the matching meeting in Supabase
      const { data: meeting, error: meetingError } = await adminDb
        .from('meetings')
        .select('id, org_id, host_id')
        .eq('stream_call_id', callId)
        .maybeSingle();

      if (meetingError || !meeting) { 
        if (meetingError) console.error(`[Sync] DB error finding meeting for call ${callId}:`, meetingError);
        skipped++; 
        continue; 
      }

      // Org-scoped: non-super-admins only sync their own org's recordings
      if (profile.role !== 'super_admin' && meeting.org_id !== profile.org_id) {
        skipped++;
        continue;
      }

      for (const rec of recordings) {
        const fileKey = rec.url ?? rec.filename ?? `${callId}/${rec.session_id || 'recording'}.mp4`;
        
        let durationSeconds: number | null = null;
        if (rec.start_time && rec.end_time) {
          const start = new Date(rec.start_time).getTime();
          const end = new Date(rec.end_time).getTime();
          if (!isNaN(start) && !isNaN(end)) {
            durationSeconds = Math.round((end - start) / 1000);
          }
        }

        // Check if already saved
        const { data: existing, error: existErr } = await adminDb
          .from('recordings')
          .select('id')
          .eq('file_key', fileKey)
          .maybeSingle();

        if (existErr || existing) { 
          if (existErr) console.error(`[Sync] DB error checking existing recording:`, existErr);
          skipped++; 
          continue; 
        }

        const { error: insertError } = await adminDb.from('recordings').insert({
          meeting_id:          meeting.id,
          org_id:              meeting.org_id,
          host_id:             meeting.host_id,
          stream_recording_id: rec.session_id ?? null,
          file_key:            fileKey,
          duration_seconds:    durationSeconds,
          status:              'ready',
        });

        if (insertError) {
          console.error(`[Sync] DB error inserting recording for meeting ${meeting.id}:`, insertError);
          failed++;
        } else {
          synced++;
        }
      }
    }

    return NextResponse.json({ success: true, synced, skipped, failed });
  } catch (err: any) {
    console.error('Recording sync failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
