'use client';

import { useState, useRef, useEffect } from 'react';
import { useQA, Question } from '@/hooks/useQA';
import { X, Send, Pin, CheckCircle2, ThumbsUp, ChevronDown, ChevronUp, MessageSquareText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  callId: string;
  onClose: () => void;
}

function QuestionCard({
  q,
  isStaff,
  onAction,
  onReply,
}: {
  q: Question;
  isStaff: boolean;
  onAction: (id: string, action: 'upvote' | 'pin' | 'answer') => void;
  onReply: (id: string, text: string) => Promise<void> | void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim() || isReplying) return;

    setIsReplying(true);
    try {
      await onReply(q.id, replyText);
      setReplyText('');
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className={cn(
      'rounded-xl border p-3 text-sm transition-all',
      q.is_pinned ? 'border-amber-400 bg-amber-950/30' : 'border-white/10 bg-white/5',
      q.is_answered && 'opacity-60'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-col gap-0.5 flex-1">
          {q.is_pinned && (
            <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          )}
          <p className="text-white leading-snug">{q.text}</p>
          <span className="text-white/40 text-[10px]">
            {q.users?.full_name || q.users?.email || 'Anonymous'}
          </span>
        </div>
      </div>

      {/* Action strip */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <button
          onClick={() => onAction(q.id, 'upvote')}
          className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-2 py-1 transition-all"
        >
          <ThumbsUp className="h-3 w-3" /> {q.upvotes}
        </button>

        {isStaff && (
          <>
            <button
              onClick={() => onAction(q.id, 'pin')}
              className={cn(
                'flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 transition-all',
                q.is_pinned
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
              )}
            >
              <Pin className="h-3 w-3" /> {q.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            {!q.is_answered && (
              <button
                onClick={() => onAction(q.id, 'answer')}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg px-2 py-1 transition-all"
              >
                <CheckCircle2 className="h-3 w-3" /> Answered
              </button>
            )}
          </>
        )}

        {q.is_answered && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 rounded-lg px-2 py-1">
            <CheckCircle2 className="h-3 w-3" /> Answered
          </span>
        )}

        {/* Toggle replies */}
        {((q.question_replies?.length ?? 0) > 0 || isStaff) && (
          <button
            onClick={() => setShowReplies(v => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] text-white/40 hover:text-white transition-all"
          >
            {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {q.question_replies?.length || 0} replies
          </button>
        )}
      </div>

      {/* Replies drawer */}
      {showReplies && (
        <div className="mt-3 pl-3 border-l border-white/10 flex flex-col gap-2">
          {q.question_replies?.map(r => (
            <div key={r.id} className="text-[11px]">
              <span className="text-white/70 font-medium">{r.users?.full_name || 'Staff'}: </span>
              <span className="text-white/60">{r.text}</span>
            </div>
          ))}

          {isStaff && (
            <div className="flex gap-1.5 mt-1">
              <input
                className="flex-1 bg-white/10 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 placeholder:text-white/30 focus:outline-none focus:border-white/30"
                placeholder="Write a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitReply()}
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || isReplying}
                className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-1.5 disabled:opacity-30 transition-all"
              >
                {isReplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QAPanel({ callId, onClose }: Props) {
  const { questions, isLoading, isStaffOrAbove, postQuestion, performAction, postReply } = useQA(callId);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handlePost = async () => {
    if (!newQuestion.trim() || isSending) return;
    setIsSending(true);

    try {
      await postQuestion(newQuestion);
      setNewQuestion('');
    } catch (error) {
      console.error('Failed to post question:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Scroll to bottom on new questions
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questions.length]);

  const pinned = questions.filter(q => q.is_pinned);
  const rest = questions.filter(q => !q.is_pinned);

  return (
    <div className="flex flex-col h-full w-[360px] bg-[#111827] border-l border-white/10 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-sky-400" />
          <h3 className="font-semibold text-sm">Q&amp;A</h3>
          {questions.length > 0 && (
            <span className="bg-sky-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {questions.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Questions list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-16 text-center">
            <MessageSquareText className="h-8 w-8 text-white/20" />
            <p className="text-white/40 text-sm">No questions yet.</p>
            <p className="text-white/20 text-xs">Be the first to ask!</p>
          </div>
        ) : (
          <>
            {/* Pinned first */}
            {pinned.map(q => (
              <QuestionCard
                key={q.id}
                q={q}
                isStaff={isStaffOrAbove}
                onAction={performAction}
                onReply={postReply}
              />
            ))}
            {pinned.length > 0 && rest.length > 0 && (
              <div className="text-[10px] text-white/20 text-center py-1">— Other questions —</div>
            )}
            {rest.map(q => (
              <QuestionCard
                key={q.id}
                q={q}
                isStaff={isStaffOrAbove}
                onAction={performAction}
                onReply={postReply}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 resize-none min-h-[40px] max-h-[100px]"
            placeholder="Ask a question..."
            value={newQuestion}
            rows={1}
            onChange={e => setNewQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <button
            onClick={handlePost}
            disabled={!newQuestion.trim() || isSending}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-30 text-white rounded-xl p-2.5 transition-all flex-shrink-0"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {!isStaffOrAbove && (
          <p className="text-[10px] text-white/20 mt-1.5 text-center">Press Enter to send · Shift+Enter for newline</p>
        )}
      </div>
    </div>
  );
}
