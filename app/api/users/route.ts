import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET: List all users on the platform (super_admin only)
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError) {
      return NextResponse.json({ error: 'Failed to load user profile' }, { status: 500 });
    }
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminDb = createAdminClient();
    
    const [usersRes, invitesRes] = await Promise.all([
      adminDb
        .from('users')
        .select('id, email, full_name, role, is_active, created_at, organisations!users_org_id_fkey(name)')
        .order('created_at', { ascending: false }),
      adminDb
        .from('invite_tokens')
        .select('id, email, role, created_at, expires_at, used_at, organisations(name)')
        .is('used_at', null)
        .order('created_at', { ascending: false })
    ]);

    if (usersRes.error) throw usersRes.error;
    if (invitesRes.error) throw invitesRes.error;

    return NextResponse.json({ 
      users: usersRes.data || [], 
      invites: invitesRes.data || [] 
    });
  } catch (err) {
    console.error('Users route failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
