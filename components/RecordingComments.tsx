'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageSquare, Clock, User as UserIcon } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  users: {
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export default function RecordingComments({ 
  recordingId, 
  onTimestampClick 
}: { 
  recordingId: string;
  onTimestampClick: (seconds: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
    // In a real app we'd configure a Supabase Realtime channel here for live comments
  }, [recordingId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/recordings/${recordingId}/comments`);
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setIsLoading(false);
    }
  };

  const postComment = async () => {
    if (!input.trim()) return;
    
    try {
      const res = await fetch(`/api/recordings/${recordingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setComments(prev => [...prev, data.comment]);
      setInput('');
      toast({ title: 'Comment posted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Parses text to find `@mentor` and `MM:SS` timestamps
  const renderCommentContent = (text: string) => {
    // Basic regex: matches @mentor
    const highlightRegex = /(@[A-Za-z0-9_]+)/g;
    // Regex for basic MM:SS or HH:MM:SS
    const timeRegex = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/g;
    const timeRegexSimple = /([0-5]?[0-9]):([0-5][0-9])/g;

    const tokens = text.split(/(\s+)/);
    
    return tokens.map((token, i) => {
      // 1. Check for @mention
      if (token.startsWith('@')) {
        return <span key={i} className="text-blue-500 font-medium">{token}</span>;
      }
      
      // 2. Check for timestamp MM:SS
      if (timeRegexSimple.test(token) || timeRegex.test(token)) {
        // Strip punctuation from end if exists
        const cleanToken = token.replace(/[.,!?]$/, '');
        return (
          <span key={i}>
            <button 
              onClick={() => {
                const parts = cleanToken.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                onTimestampClick(seconds);
              }}
              className="text-sky-500 font-medium hover:underline bg-sky-500/10 px-1 rounded inline-flex items-center gap-1"
            >
              <Clock size={12} /> {cleanToken}
            </button>
            {token.slice(cleanToken.length)} 
          </span>
        );
      }
      
      return <span key={i}>{token}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <MessageSquare size={18} className="text-sky-600" />
          Class Discussion
        </h3>
        <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
          {comments.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center p-4"><div className="animate-pulse flex space-x-4"><div className="rounded-full bg-gray-200 h-10 w-10"></div><div className="flex-1 space-y-6 py-1"><div className="h-2 bg-gray-200 rounded"></div><div className="space-y-3"><div className="grid grid-cols-3 gap-4"><div className="h-2 bg-gray-200 rounded col-span-2"></div><div className="h-2 bg-gray-200 rounded col-span-1"></div></div></div></div></div></div>
        ) : comments.length === 0 ? (
          <div className="text-center text-gray-400 py-10 flex flex-col items-center gap-2">
            <MessageSquare size={32} className="opacity-20" />
            <p className="text-sm">No comments yet. Start the discussion!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 relative group">
              <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <UserIcon size={16} className="text-sky-600" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm text-gray-800">
                    {comment.users?.full_name || 'User'}
                    {comment.users?.role === 'staff' || comment.users?.role === 'org_admin' ? (
                       <span className="ml-1 text-[10px] bg-sky-100 text-sky-700 px-1 py-0.5 rounded uppercase font-bold tracking-wider">Teacher</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString()} at {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap leading-relaxed">
                  {renderCommentContent(comment.content)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <label className="text-xs font-semibold text-gray-500 mb-2 block">
          Add a comment (use @mentor to tag, or MM:SS to reference time)
        </label>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && postComment()}
            placeholder="E.g. @mentor I didn't understand the concept at 25:30"
            className="flex-1 text-sm bg-white border-gray-200"
          />
          <Button onClick={postComment} disabled={!input.trim()} className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm">
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
