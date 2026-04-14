'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRole } from '@/hooks/useRole';

export interface Reply {
  id: string;
  question_id: string;
  replied_by: string;
  text: string;
  created_at: string;
  users?: { full_name?: string; email?: string };
}

export interface Question {
  id: string;
  meeting_id: string;
  asked_by: string;
  text: string;
  upvotes: number;
  is_answered: boolean;
  is_pinned: boolean;
  created_at: string;
  users?: { full_name?: string; email?: string };
  question_replies?: Reply[];
}

export function useQA(callId: string) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isStaffOrAbove } = useRole();
  const supabase = useMemo(() => createClient(), []);

  const fetchQuestions = useCallback(async () => {
    if (!callId) return;
    try {
      const res = await fetch(`/api/questions?callId=${encodeURIComponent(callId)}`);
      if (!res.ok) {
        throw new Error(`Failed to load questions (${res.status})`);
      }

      const data = await res.json();
      setQuestions(data.questions || []);
      if (data.meetingId) setMeetingId(data.meetingId);
    } catch (e) {
      console.error('Failed to fetch questions', e);
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    if (!meetingId) return;

    // Use meetingId for a stable channel name
    const channel = supabase.channel(`qa-meeting-${meetingId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => fetchQuestions()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'question_replies',
          // Note: We don't filter by IDs here to keep the subscription stable.
          // RLS ensures the user only receives changes they have access to.
        },
        () => fetchQuestions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, fetchQuestions, supabase]);

  const postQuestion = async (text: string) => {
    if (!meetingId || !text.trim()) return;
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, text }),
    });

    if (!res.ok) {
      throw new Error(`Failed to post question (${res.status})`);
    }
  };

  const performAction = async (questionId: string, action: 'upvote' | 'pin' | 'answer') => {
    try {
      const res = await fetch('/api/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, action }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed to ${action} question`);
      }

      return data;
    } catch (error) {
      console.error(`Failed to ${action} question:`, error);
      throw error;
    }
  };

  const postReply = async (questionId: string, text: string) => {
    if (!text.trim()) return;
    if (!user?.id) {
      throw new Error('You must be signed in to reply.');
    }

    const { error } = await supabase.from('question_replies').insert({
      question_id: questionId,
      replied_by: user?.id,
      text,
    });

    if (error) {
      console.error('Failed to post reply:', error);
      throw new Error('Failed to post reply');
    }
  };

  return {
    questions,
    meetingId,
    isLoading,
    isStaffOrAbove,
    postQuestion,
    performAction,
    postReply,
    refetch: fetchQuestions,
  };
}
