import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id: streamCallId } = await props.params;
    if (!streamCallId) {
      return NextResponse.json({ error: 'Missing stream_call_id' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminDb = createAdminClient();

    // Verify user is host or admin
    const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single();
    const { data: meeting } = await adminDb.from('meetings').select('host_id').eq('stream_call_id', streamCallId).single();

    if (!profile || !meeting || (meeting.host_id !== user.id && !['staff', 'org_admin', 'super_admin'].includes(profile.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark as ended
    const { error } = await adminDb
      .from('meetings')
      .update({ status: 'ended' })
      .eq('stream_call_id', streamCallId);

    if (error) {
      console.error('Failed to end meeting directly:', error);
      return NextResponse.json({ error: 'Failed to update meeting status' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error ending meeting:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
