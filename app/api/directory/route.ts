import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleString = searchParams.get('role'); // comma separated e.g. "staff,student"
    const roles = roleString ? roleString.split(',') : ['staff', 'student'];

    // RLS handles the isolation logic natively, so we just select from users
    const [usersResult, invitesResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, role, org_id, created_at, is_active')
        .in('role', roles)
        .order('created_at', { ascending: false }),
      supabase
        .from('invite_tokens')
        .select('id, email, role, created_at, expires_at, used_at')
        .in('role', roles)
        .order('created_at', { ascending: false })
    ]);

    if (usersResult.error) throw usersResult.error;
    if (invitesResult.error) throw invitesResult.error;

    const users = usersResult.data;
    const invites = invitesResult.data;

    return NextResponse.json({ users, invites });
  } catch (err: any) {
    console.error('Directory route failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
