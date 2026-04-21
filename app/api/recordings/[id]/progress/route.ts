import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { watchedSeconds, lastPositionSeconds, completed } = body;

    const { error } = await supabase
      .from('recording_progress')
      .upsert(
        { 
          recording_id: params.id, 
          user_id: user.id, 
          watched_seconds: watchedSeconds,
          last_position_seconds: lastPositionSeconds,
          completed: completed,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'recording_id,user_id' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Progress API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
