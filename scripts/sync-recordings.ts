/**
 * Manual Sync Script
 * Pulls all recordings from Stream Cloud and syncs them directly into Supabase.
 * This bypasses the webhook entirely — useful when webhooks can't reach localhost.
 *
 * Usage: npx tsx scripts/sync-recordings.ts
 */
import { StreamClient } from '@stream-io/node-sdk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey     = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const apiSecret  = process.env.STREAM_API_SECRET!;
const supaUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supaKey    = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  if (!apiKey || !apiSecret || !supaUrl || !supaKey) {
    console.error('❌ Missing env vars. Ensure NEXT_PUBLIC_STREAM_API_KEY, STREAM_API_SECRET, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  try {
    const parsedUrl = new URL(supaUrl);
    if (parsedUrl.protocol !== 'https:') throw new Error('Supabase URL must use https:');
  } catch (e: any) {
    console.error(`❌ Invalid NEXT_PUBLIC_SUPABASE_URL: ${e.message}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg) : 50;

  const streamClient = new StreamClient(apiKey, apiSecret, { timeout: 30000 });
  const supabase = createClient(supaUrl, supaKey);

  console.log(`📡 Fetching latest ${limit} calls from Stream...`);

  const { calls } = await streamClient.video.queryCalls({
    sort: [{ field: 'created_at', direction: -1 }],
    limit: limit,
  });

  console.log(`Found ${calls.length} call(s). Checking recordings for each...`);

  let synced = 0;
  let skipped = 0;

  for (const callState of calls) {
    const callId = callState.call.id;
    const title  = callState.call.custom?.title || 'Untitled';

    let recordings;
    try {
      const res = await streamClient.video.call('default', callId).listRecordings();
      recordings = res.recordings;
    } catch {
      continue;
    }

    if (recordings.length === 0) continue;

    // Look up matching meeting in Supabase
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, org_id, host_id')
      .eq('stream_call_id', callId)
      .maybeSingle();

    if (meetingError || !meeting) {
      if (meetingError) console.error(`  ❌ Error searching for meeting "${title}":`, meetingError.message);
      else console.log(`  ⚠️  Skipping "${title}" — no matching meeting in DB.`);
      skipped++;
      continue;
    }

    for (const rec of recordings) {
      if (!rec.url) {
        console.log(`  ⏳ Skipping recording for "${title}" — URL not available yet.`);
        continue;
      }

      const fileKey = rec.url;
      const durationMs = rec.end_time && rec.start_time
        ? new Date(rec.end_time).getTime() - new Date(rec.start_time).getTime()
        : null;

      // Check if already exists
      const { data: existing, error: existError } = await supabase
        .from('recordings')
        .select('id')
        .eq('file_key', fileKey)
        .maybeSingle();

      if (existing) {
        console.log(`  ✅ "${title}" already in DB — skipping.`);
        skipped++;
        continue;
      }

      const { error } = await supabase.from('recordings').insert({
        meeting_id:          meeting.id,
        org_id:              meeting.org_id,
        host_id:             meeting.host_id,
        stream_recording_id: rec.session_id ?? null,
        file_key:            fileKey,
        duration_seconds:    durationMs ? Math.round(durationMs / 1000) : null,
        status:              'ready',
      });

      if (error) {
        console.error(`  ❌ Failed to insert recording for "${title}":`, error.message);
      } else {
        console.log(`  🎬 Synced recording for "${title}"!`);
        synced++;
      }
    }
  }

  console.log(`\n✅ Sync complete — ${synced} synced, ${skipped} skipped.`);
}

run().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
