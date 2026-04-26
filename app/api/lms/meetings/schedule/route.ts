import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, badRequestResponse } from '@/lib/api-auth';
import { sendMeetingScheduledEmail } from '@/lib/email';
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

  const { title, host_email, org_id, subject, module, topic, subtopic, description, scheduled_at, duration_minutes, invited_emails, invited_batch_ids } = body;

  if (!title || !host_email || !org_id || !scheduled_at || !duration_minutes) {
    return badRequestResponse('title, host_email, org_id, scheduled_at, and duration_minutes are required');
  }

  const scheduledDate = new Date(scheduled_at);
  if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
    return badRequestResponse('scheduled_at must be a valid future date');
  }

  if (typeof duration_minutes !== 'number' || duration_minutes < 15 || duration_minutes > 480) {
    return badRequestResponse('duration_minutes must be between 15 and 480');
  }

  const adminDb = createAdminClient();

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
              'custom_css.url': `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://lms.yourdomain.com'}/recording-theme.css`
            }
          }
        }
      },
      starts_at: scheduledDate.toISOString(),
    },
  });

  const emailUsers = await resolveUsersByEmail(invited_emails || [], org_id);
  const batchUsers = await resolveUsersByBatch(invited_batch_ids || [], org_id);
  const finalInvitees = mergeAndDeduplicateInvitees(emailUsers, batchUsers);

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
      meeting_type: 'scheduled',
      status: 'scheduled',
      scheduled_at: scheduledDate.toISOString(),
      duration_minutes
    })
    .select('*, users!meetings_host_id_fkey(full_name, email), subjects(name)')
    .single();

  if (meetingError) {
    console.error(meetingError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const responseMeeting = buildMeetingResponse(meeting, false);
  responseMeeting.invited_count = finalInvitees.length;

  if (finalInvitees.length > 0) {
    const invites = finalInvitees.map(u => ({
      meeting_id: meeting.id,
      user_id: u.id
    }));
    await adminDb.from('meeting_invites').insert(invites);

    for (const invitee of finalInvitees) {
      await sendMeetingScheduledEmail(invitee.email, responseMeeting).catch(console.error);
    }
    
    await notifyUsers(
      finalInvitees.map(u => u.id),
      `A new lecture has been scheduled: ${title}`,
      `Starts at ${scheduledDate.toLocaleString()}`,
      'meeting_scheduled',
      meeting.id
    );
  }

  await logApiCall('lms_create_scheduled_meeting', org_id, '/api/lms/meetings/schedule', {
    meeting_id: meeting.id,
    invited_count: finalInvitees.length
  });

  return NextResponse.json({
    success: true,
    meeting: responseMeeting
  });
}
