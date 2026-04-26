import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StreamClient } from '@stream-io/node-sdk';

import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabaseServer = createSupabaseServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) throw new Error("Unauthorized user");

    const body = await request.json().catch(() => ({}));
    const startsAt = body.startsAt || new Date(Date.now() + 86400000).toISOString();
    const description = body.description || "Scheduled Meeting";
    
    const meetingId = crypto.randomUUID();
    const joinUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/meeting/${meetingId}`;

    // Create actual meeting inside GetStream Backend
    const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const STREAM_API_SECRET = process.env.STREAM_API_SECRET;
    if (STREAM_API_KEY && STREAM_API_SECRET) {
      const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
      
      // Upsert the actual teacher user to ensure they are admin/host
      await streamClient.upsertUsers({
        users: {
          [user.id]: {
            id: user.id,
            name: user.email?.split('@')[0] || user.id,
            role: 'admin',
          }
        }
      });
      
      const call = streamClient.video.call('default', meetingId);
      await call.getOrCreate({
        data: {
          starts_at: startsAt,
          created_by_id: user.id,
          custom: { description },
          settings_override: {
            recording: {
              mode: 'available',
              quality: '1080p',
              layout: {
                name: 'grid',
                options: {
                  'custom_css.url': `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://lms.yourdomain.com'}/recording-theme.css`
                }
              }
            }
          }
        }
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.from('lms_meetings').insert({
      meeting_id: meetingId,
      description: description,
      starts_at: startsAt,
      join_url: joinUrl
    });

    if (error) {
      return NextResponse.json({ status: 'error', message: error.message, details: error.details, hint: error.hint }, { status: 500 });
    }
    
    return NextResponse.json({
      status: 'success',
      returncode: 'SUCCESS',
      message: 'Meeting scheduled successfully',
      meeting: {
        meetingId,
        description,
        startsAt,
        joinUrl,
        createdAt: new Date().toISOString()
      }
    });

  } catch (err: any) {
    console.error("API ROUTE ERROR:", err);
    return NextResponse.json({ status: 'error', message: err.message, stack: err.stack }, { status: 500 });
  }
}
