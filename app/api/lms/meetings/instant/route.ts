import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, badRequestResponse, unauthorizedResponse } from '@/lib/api-auth';
import { 
  resolveUsersByEmail, 
  resolveUsersByBatch, 
  mergeAndDeduplicateInvitees, 
  buildMeetingResponse, 
  logApiCall,
  notifyUsers 
} from '@/lib/lms-api';

export async function POST(request: Request) {
  const auth = validateApiKey(request);
  if (!auth.valid) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse('Invalid JSON');
  }

  const { title, host_email, org_id, subject, module, topic, subtopic, description, invited_emails, invited_batch_ids } = body;

  if (!title || !host_email || !org_id) {
    return badRequestResponse('title, host_email, and org_id are required');
  }

  if ((!invited_emails || invited_emails.length === 0) && (!invited_batch_ids || invited_batch_ids.length === 0)) {
    return badRequestResponse('At least one of invited_emails or invited_batch_ids must be provided');
  }

  const adminDb = createAdminClient();

  // Validate Host
  const { data: host } = await adminDb
    .from('users')
    .select('id, role, email, full_name')
    .eq('org_id', org_id)
    .eq('email', host_email.toLowerCase())
    .single();

  if (!host || !['staff', 'org_admin', 'super_admin'].includes(host.role)) {
    return badRequestResponse('Host email does not belong to a valid staff member or admin in this organisation');
  }

  const streamClient = new StreamClient(
    process.env.NEXT_PUBLIC_STREAM_API_KEY!,
    process.env.STREAM_API_SECRET!
  );

  const callId = `call_${crypto.randomUUID()}`;
  const streamCall = streamClient.video.call('default', callId);

  const hostHeader = request.headers.get('host');
  const protocol = hostHeader?.includes('localhost') ? 'http' : 'https';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (hostHeader ? `${protocol}://${hostHeader}` : null);
  
  if (!baseUrl) {
    return NextResponse.json({ error: 'Server configuration error: missing BASE_URL' }, { status: 500 });
  }

  await streamCall.getOrCreate({
    data: {
      created_by_id: host.id,
      custom: {
        title: title.trim(),
        description: description ? description.trim() : '',
      },
      settings_override: {
        recording: {
          mode: 'available',
          quality: '1080p',
          layout: {
            name: 'grid',
            options: {
              'custom_css.url': `${baseUrl}/recording-theme.css`
            }
          }
        }
      },
    },
  });

  // Resolve invitees
  const emailUsers = await resolveUsersByEmail(invited_emails || [], org_id);
  const batchUsers = await resolveUsersByBatch(invited_batch_ids || [], org_id);
  const finalInvitees = mergeAndDeduplicateInvitees(emailUsers, batchUsers);

  // Insert meeting
  let subjectRecordId = null;
  
  if (subject) {
      const { data: sub } = await adminDb.from('subjects').select('id, name').eq('org_id', org_id).eq('name', subject).single();
      if(sub) subjectRecordId = sub.id;
  }

  const { data: meeting, error: meetingError } = await adminDb
    .from('meetings')
    .insert({
      org_id,
      host_id: host.id,
      stream_call_id: callId,
      title: title.trim(),
      description: description ? description.trim() : null,
      subject_id: subjectRecordId, // Optional mapping
      module,
      topic,
      subtopic,
      meeting_type: 'instant',
      status: 'live',
      scheduled_at: new Date().toISOString()
    })
    .select('*, users!meetings_host_id_fkey(full_name, email), subjects(name)')
    .single();

  if (meetingError) {
    console.error(meetingError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Insert Invites
  if (finalInvitees.length > 0) {
    const invites = finalInvitees.map(u => ({
      meeting_id: meeting.id,
      user_id: u.id
    }));
    await adminDb.from('meeting_invites').insert(invites);

    // Notify
    await notifyUsers(
      finalInvitees.map(u => u.id),
      `A live session has started: ${title}`,
      'Join now to participate',
      'meeting_started',
      meeting.id
    );
  }

  await logApiCall('lms_create_instant_meeting', org_id, '/api/lms/meetings/instant', {
    meeting_id: meeting.id,
    invited_count: finalInvitees.length
  });

  const responseMeeting = buildMeetingResponse(meeting, false);
  responseMeeting.invited_count = finalInvitees.length;

  return NextResponse.json({
    success: true,
    meeting: responseMeeting
  });
}
