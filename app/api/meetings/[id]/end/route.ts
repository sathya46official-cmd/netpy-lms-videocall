import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const streamCallId = params.id;
    if (!streamCallId) {
      return NextResponse.json({ error: 'Missing stream_call_id' }, { status: 400 });
    }

    const adminDb = createAdminClient();

    // Mark as ended
    const { error } = await adminDb
      .from('meetings')
      .update({ status: 'ended' })
      .eq('stream_call_id', streamCallId);

    if (error) {
      console.error('Failed to end meeting directly:', error);
      return NextResponse.json({ error: 'Failed to update meeting status' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error ending meeting:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
