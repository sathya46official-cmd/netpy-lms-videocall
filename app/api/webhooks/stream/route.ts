import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { archiveRecording } from '@/lib/archiver';

/**
 * Stream Webhook Handler
 * 
 * Stream sends POST to this endpoint on recording events.
 * Configure this URL in Stream Dashboard → Webhooks:
 *   https://yourdomain.com/api/webhooks/stream
 * 
 * Event handled: call.recording_ready
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const sig = request.headers.get('x-signature');
    const secret = process.env.STREAM_API_SECRET || process.env.STREAM_WEBHOOK_SECRET;

    // Webhook Security Signature Verification
    if (secret) {
      if (!sig) {
        console.error('[Stream Webhook] Missing x-signature header while secret is configured');
        return NextResponse.json({ error: 'Unauthorized: Missing signature' }, { status: 401 });
      }
      
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      
      if (sig !== expectedSig) {
        console.error('[Stream Webhook] Invalid signature detected');
        return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('[Stream Webhook] Running without signature verification. Set STREAM_API_SECRET for production.');
    }

    const body = JSON.parse(rawBody);

    // Log all events for debugging
    console.log('[Stream Webhook] Event received:', body.type, JSON.stringify(body).slice(0, 500));

    // Supported events
    const supportedEvents = ['call.recording_ready', 'call.session_participant_joined', 'call.session_participant_left'];
    if (!supportedEvents.includes(body.type)) {
      return NextResponse.json({ received: true });
    }

    const adminDb = createAdminClient();

    // Ensure call_cid exists
    if (!body.call_cid) {
      console.error('[Stream Webhook] Missing call_cid');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    
    // call_cid format: "default:CALL_UUID"
    const streamCallId = body.call_cid.split(':')[1];
    
    // Find the meeting
    const { data: meeting, error: meetingError } = await adminDb
      .from('meetings')
      .select('id, org_id, host_id')
      .eq('stream_call_id', streamCallId)
      .maybeSingle();

    if (meetingError || !meeting) {
      console.error('[Stream Webhook] Meeting not found for stream_call_id:', streamCallId);
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // --- STREAM ATTENDANCE PROCESSING ---
    if (body.type === 'call.session_participant_joined' || body.type === 'call.session_participant_left') {
        const userId = body.participant?.user?.id;
        if (!userId) {
             return NextResponse.json({ error: 'Missing user ID in participant' }, { status: 400 });
        }

        if (body.type === 'call.session_participant_joined') {
            await adminDb.from('meeting_attendance').insert({
                meeting_id: meeting.id,
                user_id: userId,
            });
            console.log('[Stream Webhook] Participant Joined:', userId);
        }

        if (body.type === 'call.session_participant_left') {
            // Find open attendance record
            const { data: openRecord } = await adminDb
                .from('meeting_attendance')
                .select('id, joined_at')
                .eq('meeting_id', meeting.id)
                .eq('user_id', userId)
                .is('left_at', null)
                .order('joined_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (openRecord) {
                const joinedAt = new Date(openRecord.joined_at).getTime();
                const leftAt = new Date().getTime();
                const durationSeconds = Math.round((leftAt - joinedAt) / 1000);

                await adminDb.from('meeting_attendance')
                  .update({
                      left_at: new Date().toISOString(),
                      duration_seconds: durationSeconds
                  })
                  .eq('id', openRecord.id);
                  
                console.log('[Stream Webhook] Participant Left:', userId, 'Duration:', durationSeconds);
            }
        }

        return NextResponse.json({ success: true });
    }

    // --- RECORDING READY PROCESSING ---
    if (body.type === 'call.recording_ready') {
      const { recording } = body;
      if (!recording) return NextResponse.json({ error: 'Missing recording in payload' }, { status: 400 });

      const rawUrl = recording.url ?? recording.filename ?? `recordings/${streamCallId}/${recording.session_id ?? 'recording'}.mp4`;
      const fileKey = rawUrl.split('?')[0];
      const sessionId = recording.session_id ?? recording.id ?? null;

      // Idempotency check
      const { data: matched } = await adminDb
        .from('recordings')
        .select('id')
        .or(
          sessionId
            ? `stream_recording_id.eq.${encodeURIComponent(sessionId)},file_key.eq.${encodeURIComponent(fileKey)}`
            : `file_key.eq.${encodeURIComponent(fileKey)}`
        )
        .limit(1);

      const existing = matched && matched.length > 0 ? matched[0] : null;

      if (existing) {
        return NextResponse.json({ success: true, duplicated: true });
      }

      let durationSeconds: number | null = null;
      if (recording.end_time && recording.start_time) {
        const start = new Date(recording.start_time).getTime();
        const end = new Date(recording.end_time).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          durationSeconds = Math.round((end - start) / 1000);
        }
      }

      const { data: newRecord, error: insertError } = await adminDb
        .from('recordings')
        .insert({
          meeting_id: meeting.id,
          org_id: meeting.org_id,
          host_id: meeting.host_id,
          stream_recording_id: sessionId,
          file_key: fileKey,
          duration_seconds: durationSeconds,
          status: 'ready',
        })
        .select('id')
        .single();

      if (insertError) {
        return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
      }

      if (sessionId) {
        archiveRecording(newRecord.id, fileKey, sessionId, meeting.id).catch(err => {
          console.error('[Archiver Trigger] Failed:', err);
        });
      }

      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    console.error('[Stream Webhook] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
