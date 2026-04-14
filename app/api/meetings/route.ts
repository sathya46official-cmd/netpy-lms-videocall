import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/utils';

const ALLOWED_MEETING_TYPES = new Set(['instant', 'scheduled']);

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('meetings')
      .select('*, subjects(name), users!meetings_host_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ meetings: data });
  } catch (error) {
    console.error('Meetings GET route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let callCreated = false;
  let streamCall: ReturnType<StreamClient['video']['call']> | null = null;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, org_id, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'org_admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only staff or above can create meetings' }, { status: 403 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { title, meetingType, subjectId, scheduledAt, description } = body as Partial<{
      title: string;
      meetingType: string;
      subjectId: string | null;
      scheduledAt: string | null;
      description: string;
    }>;

    if (typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const normalizedMeetingType = (meetingType ?? 'instant') as 'instant' | 'scheduled';
    if (!ALLOWED_MEETING_TYPES.has(normalizedMeetingType)) {
      return NextResponse.json({ error: 'Invalid meeting type' }, { status: 400 });
    }

    if (normalizedMeetingType === 'scheduled' && (!scheduledAt || typeof scheduledAt !== 'string')) {
      return NextResponse.json({ error: 'Scheduled meetings require a valid date' }, { status: 400 });
    }

    let scheduledDate: Date | null = null;
    if (normalizedMeetingType === 'scheduled') {
      scheduledDate = new Date(scheduledAt!);
      if (Number.isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduled date' }, { status: 400 });
      }
    }

    const streamClient = new StreamClient(
      process.env.NEXT_PUBLIC_STREAM_API_KEY!,
      process.env.STREAM_API_SECRET!
    );

    const callId = crypto.randomUUID();
    streamCall = streamClient.video.call('default', callId);

    await streamCall.getOrCreate({
      data: {
        created_by_id: user.id,
        custom: {
          title: title.trim(),
          description: typeof description === 'string' ? description.trim() : '',
        },
        settings_override: { recording: { mode: 'available', quality: '720p' } },
        ...(scheduledDate ? { starts_at: scheduledDate.toISOString() } : {}),
      },
    });
    callCreated = true;

    try {
      const { data: meeting, error: meetingError } = await createAdminClient()
        .from('meetings')
        .insert({
          org_id: profile.org_id,
          host_id: user.id,
          stream_call_id: callId,
          title: title.trim(),
          description: typeof description === 'string' ? description.trim() : null,
          subject_id: subjectId || null,
          meeting_type: normalizedMeetingType,
          status: normalizedMeetingType === 'scheduled' ? 'scheduled' : 'live',
          scheduled_at: normalizedMeetingType === 'scheduled' ? scheduledDate?.toISOString() : null,
        })
        .select()
        .single();

      if (meetingError) {
        throw meetingError;
      }

      return NextResponse.json({
        success: true,
        meeting,
        meetingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/meeting/${callId}`,
      });
    } catch (dbError) {
      if (callCreated && streamCall) {
        try {
          await streamCall.endCall();
        } catch (cleanupError) {
          console.error('Failed to clean up Stream call after meeting insert error:', {
            callId,
            error: getErrorMessage(cleanupError),
          });
        }
      }

      throw dbError;
    }
  } catch (error) {
    console.error('Meetings POST route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
