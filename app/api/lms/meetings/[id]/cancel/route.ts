import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, badRequestResponse, notFoundResponse, forbiddenResponse } from '@/lib/api-auth';
import { sendMeetingCancelledEmail } from '@/lib/email';
import { logApiCall, notifyUsers } from '@/lib/lms-api';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = validateApiKey(request);
  if (!auth.valid) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse('Invalid JSON');
  }

  const { org_id, reason, notify_participants } = body;

  if (!org_id || !reason) {
    return badRequestResponse('org_id and reason are required');
  }

  const adminDb = createAdminClient();

  // Validate Meeting
  const { data: meeting, error } = await adminDb
    .from('meetings')
    .select('*')
    .eq('id', (await props.params).id)
    .single();

  if (error || !meeting) {
    return notFoundResponse('Meeting not found');
  }

  if (meeting.org_id !== org_id) {
    return forbiddenResponse('Meeting does not belong to the provided org_id');
  }

  if (meeting.status !== 'scheduled') {
    return badRequestResponse(`Only scheduled meetings can be cancelled. Current status: ${meeting.status}`);
  }

  // Update Status
  const { error: updateError } = await adminDb
    .from('meetings')
    .update({ 
      status: 'cancelled',
      cancelled_reason: reason.trim() 
    })
    .eq('id', (await props.params).id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  let notified_count = 0;

  if (notify_participants) {
    // Fetch participants
    const { data: invites } = await adminDb
      .from('meeting_invites')
      .select('user_id, users(email)')
      .eq('meeting_id', (await props.params).id);

    if (invites && invites.length > 0) {
      notified_count = invites.length;
      const userIds: string[] = [];
      const emails: string[] = [];

      for(const inv of invites) {
         if (inv.user_id) userIds.push(inv.user_id);
         const u = Array.isArray(inv.users) ? inv.users[0] : inv.users;
         if (u && u.email) emails.push(u.email);
      }

      for (const email of emails) {
        await sendMeetingCancelledEmail(email, meeting, reason).catch(console.error);
      }

      await notifyUsers(
        userIds,
        `Lecture Cancelled: ${meeting.title}`,
        reason,
        'meeting_cancelled',
        meeting.id
      );
    }
  }

  await logApiCall('lms_cancel_meeting', org_id, `/api/lms/meetings/${(await props.params).id}/cancel`, {
    reason,
    notified_count
  });

  return NextResponse.json({
    success: true,
    message: 'Meeting cancelled successfully.',
    notified_count
  });
}
