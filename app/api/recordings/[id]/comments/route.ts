import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: comments, error } = await supabase
      .from('recording_comments')
      .select('*, users(full_name, email, role, avatar_url)')
      .eq('recording_id', params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments });
  } catch (err: any) {
    console.error('Comments GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { content, parent_id } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('recording_comments')
      .insert({
        recording_id: params.id,
        user_id: user.id,
        content,
        parent_id: parent_id || null
      })
      .select('*, users(full_name, email, role, avatar_url)')
      .single();

    if (error) throw error;

    return NextResponse.json({ comment: data });
  } catch (err: any) {
    console.error('Comments POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
