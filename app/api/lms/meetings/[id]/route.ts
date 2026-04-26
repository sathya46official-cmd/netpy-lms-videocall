import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, badRequestResponse, notFoundResponse, forbiddenResponse } from '@/lib/api-auth';
import { buildMeetingResponse, logApiCall } from '@/lib/lms-api';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = validateApiKey(request);
  if (!auth.valid) return auth.response;

  const { searchParams } = new URL(request.url);
  const org_id = searchParams.get('org_id');

  if (!org_id) {
    return badRequestResponse('org_id is required as a query parameter');
  }

  const adminDb = createAdminClient();

  const { data: meeting, error } = await adminDb
    .from('meetings')
    .select('*, users!meetings_host_id_fkey(full_name, email), subjects(name)')
    .eq('id', (await props.params).id)
    .single();

  if (error || !meeting) {
    return notFoundResponse('Meeting not found');
  }

  if (meeting.org_id !== org_id) {
    return forbiddenResponse('Meeting does not belong to the provided org_id');
  }

  const responseMeeting = buildMeetingResponse(meeting, true);

  await logApiCall('lms_get_meeting_details', org_id, `/api/lms/meetings/${(await props.params).id}`);

  return NextResponse.json({
    success: true,
    meeting: responseMeeting
  });
}
