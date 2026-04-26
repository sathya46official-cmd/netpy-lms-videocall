import { createAdminClient } from '@/lib/supabase/admin';
import { Role } from './permissions';
import crypto from 'crypto';

export async function createInviteToken(
  email: string,
  role: Role,
  orgId: string | null,
  invitedBy: string
) {
  const adminDb = createAdminClient();
  const token = crypto.randomUUID();
  
  // Expiry is 72 hours from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  const { error } = await adminDb
    .from('invite_tokens')
    .insert({
      email,
      role,
      org_id: orgId === 'platform' ? null : orgId,
      invited_by: invitedBy,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error('Failed to create invite: ' + error.message);
  }

  // Returns the relative URL for the invite acceptance
  return `/invite/accept?token=${token}`;
}

export async function validateToken(token: string) {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('invite_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Invalid or expired token.' };
  }

  if (data.used_at) {
    return { valid: false, error: 'This invite has already been used.' };
  }

  if (new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'This invite has expired.' };
  }

  return { valid: true, data };
}

export async function validateAndConsumeToken(token: string) {
  const adminDb = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await adminDb
    .from('invite_tokens')
    .update({ used_at: now })
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('*')
    .single();

  if (error || !data) {
    return { valid: false, error: 'Invalid or expired token.' };
  }

  return { valid: true, data };
}

export async function markTokenUsed(tokenId: string) {
  const adminDb = createAdminClient();
  const { error, data } = await adminDb
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId)
    .is('used_at', null)
    .select('id');

  if (error || !data || data.length === 0) {
    throw new Error(`Failed to mark invite token ${tokenId} as used.`);
  }
}
