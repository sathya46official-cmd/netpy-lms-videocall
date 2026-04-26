import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey, badRequestResponse, notFoundResponse, forbiddenResponse } from '@/lib/api-auth';
import { buildEmbedResponse, logApiCall } from '@/lib/lms-api';

export async function GET(request: Request, props: { params: Promise<{ meeting_id: string }> }) {
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
    .eq('id', (await props.params).meeting_id)
    .single();

  if (error || !meeting) {
    return notFoundResponse('Meeting not found');
  }

  if (meeting.org_id !== org_id) {
    return forbiddenResponse('Meeting does not belong to the provided org_id');
  }

  if (!meeting.recording_url) {
    return notFoundResponse('No recording available for this meeting yet. Check back after the session ends.');
  }

  const embedRes = buildEmbedResponse(meeting.id);
  const hostInfo = meeting.users || meeting.host;

  await logApiCall('lms_get_recording_details', org_id, `/api/lms/recordings/${(await props.params).meeting_id}`);

  return NextResponse.json({
    success: true,
    recording: {
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      subject: meeting.subjects?.name || null,
      module: meeting.module,
      topic: meeting.topic,
      subtopic: meeting.subtopic,
      host: hostInfo ? {
        name: hostInfo.full_name,
        email: hostInfo.email
      } : null,
      recorded_at: meeting.scheduled_at, // Better if recording real timestamp is captured, fallback to scheduled
      duration_minutes: meeting.duration_minutes,
      embed_url: embedRes.embed_url,
      embed_code: embedRes.embed_code
    }
  });
}
