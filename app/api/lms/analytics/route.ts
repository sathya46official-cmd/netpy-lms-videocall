import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'org_admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden. Staff access required.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('userId');

    let query = supabase
      .from('meeting_attendance')
      .select(`
        id,
        duration_seconds,
        joined_at,
        left_at,
        meetings (id, title, scheduled_at),
        users!inner (id, full_name, email, org_id)
      `)
      .order('joined_at', { ascending: false });

    // Restrict strictly by org_id if not super_admin
    if (profile.role !== 'super_admin') {
      if (!profile.org_id) return NextResponse.json({ data: [] });
      query = query.eq('users.org_id', profile.org_id);
    }

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;

    if (error) {
       console.error('[Analytics GET] Supabase Error:', error);
       throw error;
    }

    // Process and aggregate
    const aggregated = data.map((record: any) => ({
      id: record.id,
      meeting_title: record.meetings?.title || 'Unknown Meeting',
      meeting_date: record.meetings?.scheduled_at,
      student_name: record.users?.full_name || record.users?.email,
      student_id: record.users?.id,
      joined_at: record.joined_at,
      left_at: record.left_at,
      duration_minutes: record.duration_seconds ? Math.round(record.duration_seconds / 60) : 0,
    }));

    return NextResponse.json({ analytics: aggregated });
  } catch (err: any) {
    console.error('LMS Analytics API failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
