/* eslint-disable camelcase */
import { createAdminClient } from './supabase/admin';

export async function resolveUsersByEmail(emails: string[], org_id: string) {
  if (!emails || emails.length === 0) return [];

  const adminDb = createAdminClient();
  const lowerEmails = emails.map(e => e.toLowerCase());

  const { data } = await adminDb
    .from('users')
    .select('id, email, full_name')
    .eq('org_id', org_id)
    .in('email', lowerEmails);

  return data || [];
}

export async function resolveUsersByBatch(batch_ids: string[], org_id: string) {
  if (!batch_ids || batch_ids.length === 0) return [];

  const adminDb = createAdminClient();

  // First verify the batches belong to the org
  const { data: validBatches } = await adminDb
    .from('batches')
    .select('id')
    .eq('org_id', org_id)
    .in('id', batch_ids);

  if (!validBatches || validBatches.length === 0) return [];
  const validBatchIds = validBatches.map(b => b.id);

  // Then get all unique users in those batches
  // Note: we fetch user details via a join
  const { data } = await adminDb
    .from('batch_members')
    .select(`
      user_id,
      users!inner(email, full_name)
    `)
    .in('batch_id', validBatchIds);

  if (!data) return [];

  const usersMap = new Map();
  for (const row of data) {
    if (!usersMap.has(row.user_id)) {
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      if (u) {
        usersMap.set(row.user_id, {
          id: row.user_id,
          email: u.email,
          full_name: u.full_name
        });
      }
    }
  }

  return Array.from(usersMap.values());
}

export function mergeAndDeduplicateInvitees(emailUsers: any[], batchUsers: any[]) {
  const merged = new Map();
  for (const u of [...emailUsers, ...batchUsers]) {
    merged.set(u.id, u);
  }
  return Array.from(merged.values());
}

export function buildMeetingResponse(meeting: any, includeRecording: boolean = false) {
  const hostInfo = meeting.users || meeting.host;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const res: any = {
    id: meeting.id,
    stream_call_id: meeting.stream_call_id,
    join_url: meeting.stream_call_id ? `${baseUrl}/meeting/${meeting.stream_call_id}` : null,
    title: meeting.title,
    subject: meeting.subjects?.name || null,
    module: meeting.module,
    topic: meeting.topic,
    subtopic: meeting.subtopic,
    description: meeting.description,
    status: meeting.status,
    meeting_type: meeting.meeting_type,
    scheduled_at: meeting.scheduled_at,
    duration_minutes: meeting.duration_minutes,
    host: hostInfo ? {
      name: hostInfo.full_name,
      email: hostInfo.email
    } : null,
    created_at: meeting.created_at
  };

  if (includeRecording) {
    res.recording_available = !!meeting.recording_url;
    if (res.recording_available) {
      const embedRes = buildEmbedResponse(meeting.id);
      res.recording_embed_url = embedRes.embed_url;
      res.recording_embed_code = embedRes.embed_code;
    } else {
      res.recording_embed_url = null;
      res.recording_embed_code = null;
    }
  }

  return res;
}

export function buildEmbedResponse(meeting_id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const embed_url = `${baseUrl}/embed/recording/${meeting_id}`;
  const embed_code = `<iframe src='${embed_url}' width='100%' height='480' frameborder='0' allowfullscreen allow='fullscreen'></iframe>`;

  return { embed_url, embed_code };
}

export async function logApiCall(action: string, org_id: string, endpoint: string, metadata: object = {}) {
  const adminDb = createAdminClient();
  await adminDb
    .from('audit_log')
    .insert({
      action,
      org_id,
      endpoint,
      metadata
    });
}

export async function notifyUsers(user_ids: string[], title: string, body: string, type: string, related_id: string) {
  if (!user_ids || user_ids.length === 0) return;
  
  const adminDb = createAdminClient();
  const payload = user_ids.map(uid => ({
    user_id: uid,
    title,
    body,
    type,
    related_id
  }));

  await adminDb.from('notifications').insert(payload);
}
