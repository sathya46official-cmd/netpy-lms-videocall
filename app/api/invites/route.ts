import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createInviteToken, validateToken } from '@/lib/invite';
import { permissions, Role } from '@/lib/permissions';
import { sendInviteEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES: Role[] = ['super_admin', 'org_admin', 'staff', 'student'];

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: currentUser } = await supabase
    .from('users')
    .select('role, org_id, full_name')
    .eq('id', user.id)
    .single();

  if (!currentUser) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { email, role, orgId } = body as Partial<{ email: string; role: string; orgId?: string | null }>;

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role as Role)) {
      return NextResponse.json({ error: 'A valid role is required' }, { status: 400 });
    }

    if (orgId !== undefined && orgId !== null && typeof orgId !== 'string') {
      return NextResponse.json({ error: 'Organization ID must be a string when provided' }, { status: 400 });
    }

    const currentRole = currentUser.role as Role;

    // Permission checks — super_admin can invite anyone including other super_admins
    if (role === 'super_admin' && currentRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can invite other Super Admins' }, { status: 403 });
    }
    if (role === 'org_admin' && !permissions.canAddOrgAdmins(currentRole)) {
      return NextResponse.json({ error: 'You do not have permission to add Org Admins' }, { status: 403 });
    }
    if (role === 'staff' && !permissions.canAddStaff(currentRole)) {
      return NextResponse.json({ error: 'You do not have permission to add Staff' }, { status: 403 });
    }
    if (role === 'student' && !permissions.canAddStudents(currentRole)) {
      return NextResponse.json({ error: 'You do not have permission to add Students' }, { status: 403 });
    }

    // Super admins don't have an org_id themselves, so they must specify one unless inviting a new super_admin
    const targetOrgId = orgId || currentUser.org_id;
    if (!targetOrgId && role !== 'super_admin') {
      return NextResponse.json({ error: 'Organization must be specified for this role' }, { status: 400 });
    }

    if (targetOrgId && targetOrgId !== currentUser.org_id && currentRole !== 'super_admin') {
      return NextResponse.json({ error: 'Can only invite to your own organization' }, { status: 403 });
    }

    const inviteUrl = await createInviteToken(
      email.trim().toLowerCase(),
      role as Role,
      targetOrgId ?? 'platform', // super_admin invites don't need an org
      user.id
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const fullInviteUrl = `${appUrl}${inviteUrl}`;

    // Fetch org name for the email if applicable
    let orgName: string | undefined;
    if (targetOrgId && targetOrgId !== 'platform') {
      const { data: org } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', targetOrgId)
        .single();
      orgName = org?.name;
    }

    // Send invite email (non-blocking — don't fail the request if email fails)
    try {
      await sendInviteEmail({
        toEmail: email.trim().toLowerCase(),
        role,
        inviteUrl: fullInviteUrl,
        invitedByName: currentUser.full_name ?? undefined,
        orgName,
      });
    } catch (emailErr) {
      console.error('Failed to send invite email (invite still created):', emailErr);
      emailSent = false;
    }

    const successMessage = emailSent 
      ? 'Invite created and email sent successfully.' 
      : 'Invite created, but failed to send the invitation email. Please share the link manually.';

    return NextResponse.json({ 
      success: true, 
      inviteUrl,
      fullInviteUrl,
      emailSent,
      message: successMessage 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { token, action } = await request.json();
    if (action === 'validate' && token) {
      const res = await validateToken(token);
      if (!res.valid) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ success: true, invite: res.data });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
