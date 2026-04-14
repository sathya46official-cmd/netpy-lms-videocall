import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPresignedUrl } from '@/lib/s3';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
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

    if (profileError || !profile) {
      if (profileError) {
        console.error('Failed to fetch user profile for recording access:', profileError);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch the recording
    const { data: recording, error: recError } = await supabase
      .from('recordings')
      .select('id, file_key, org_id, status')
      .eq('id', params.id)
      .single();

    if (recError || !recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    if (recording.status !== 'ready') {
      return NextResponse.json({ error: 'Recording is not ready yet' }, { status: 409 });
    }

    // Access control: super_admin can access all, others must be in the same org
    if (profile.role !== 'super_admin') {
      if (!recording.org_id || recording.org_id !== profile.org_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Generate 1-hour presigned URL
    const url = await getPresignedUrl(recording.file_key, 3600);

    return NextResponse.json({ url, expiresInSeconds: 3600 });
  } catch (err: any) {
    console.error('Recording URL generation failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
