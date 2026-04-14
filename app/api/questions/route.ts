import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id')
      .eq('stream_call_id', callId)
      .maybeSingle();

    if (meetingError) {
      throw meetingError;
    }

    if (!meeting) {
      return NextResponse.json({ questions: [] });
    }

    const { data: questions, error } = await supabase
      .from('questions')
      .select(
        '*, users!questions_asked_by_fkey(full_name, email), question_replies(*, users!question_replies_replied_by_fkey(full_name, email))'
      )
      .eq('meeting_id', meeting.id)
      .order('is_pinned', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ questions, meetingId: meeting.id });
  } catch (error) {
    console.error('Questions GET route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meetingId, text } = await request.json();
    if (!meetingId || !text?.trim()) {
      return NextResponse.json({ error: 'meetingId and text are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({ meeting_id: meetingId, asked_by: user.id, text })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, question: data });
  } catch (error) {
    console.error('Questions POST route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId, action } = await request.json();
    if (!questionId || !action) {
      return NextResponse.json({ error: 'questionId and action are required' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const isStaff = ['super_admin', 'org_admin', 'staff'].includes(profile?.role);
    const adminDb = createAdminClient();

    // For staff-only actions, ensure the question belongs to the user's organisation
    if (['pin', 'answer'].includes(action)) {
      if (!isStaff) {
        return NextResponse.json({ error: 'Action not permitted' }, { status: 403 });
      }

      // Check org match (super_admin bypasses)
      if (profile?.role !== 'super_admin') {
        const { data: qMeeting } = await adminDb
          .from('questions')
          .select('meetings(org_id)')
          .eq('id', questionId)
          .single();
        
        const qOrgId = (qMeeting as any)?.meetings?.org_id;
        if (!qOrgId || qOrgId !== profile?.org_id) {
          return NextResponse.json({ error: 'Access denied: Question/Meeting from different organisation' }, { status: 403 });
        }
      }
    }

    if (action === 'upvote') {
      const { data: upvoteRecorded, error: upvoteError } = await adminDb.rpc('increment_question_upvotes', {
        p_question_id: questionId,
        p_user_id: user.id,
      });

      if (upvoteError) {
        throw upvoteError;
      }

      return NextResponse.json({ success: true, upvoted: Boolean(upvoteRecorded) });
    }

    if (action === 'pin' && isStaff) {
      const { data: question, error: questionError } = await adminDb
        .from('questions')
        .select('is_pinned')
        .eq('id', questionId)
        .single();

      if (questionError || !question) {
        throw questionError ?? new Error('Question not found');
      }

      const { error: updateError } = await adminDb
        .from('questions')
        .update({ is_pinned: !question.is_pinned })
        .eq('id', questionId);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'answer' && isStaff) {
      const { error: updateError } = await adminDb
        .from('questions')
        .update({ is_answered: true })
        .eq('id', questionId);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action not permitted' }, { status: 403 });
  } catch (error) {
    console.error('Questions PATCH route failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
