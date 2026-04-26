import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_DELETE_ROLES = ['staff', 'org_admin', 'super_admin'];

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[Recording Delete] Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!profile || !ALLOWED_DELETE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const adminDb = createAdminClient();
    const { id } = await props.params;

    // Fetch the recording to check org ownership
    const { data: recording, error: fetchErr } = await adminDb
      .from('recordings')
      .select('id, org_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Recording Delete] DB fetch error:', fetchErr);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Org scope guard: non-super-admins can only delete their own org's recordings
    if (profile.role !== 'super_admin' && recording.org_id !== profile.org_id) {
      return NextResponse.json({ error: 'Forbidden: Recording belongs to a different organization' }, { status: 403 });
    }

    const { error: deleteError } = await adminDb
      .from('recordings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Recording Delete] Failed:', deleteError);
      return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 });
    }

    console.log(`[Recording Delete] Deleted recording ${id} by user ${user.id}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Recording Delete] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
