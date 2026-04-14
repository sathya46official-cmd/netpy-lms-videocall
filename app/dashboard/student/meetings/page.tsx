'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Video, Calendar, Clock, ExternalLink } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-red-100 text-red-700',
  scheduled: 'bg-blue-100 text-blue-700',
  ended: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-yellow-100 text-yellow-700',
};

export default function StudentMeetingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings');
      const data = await res.json().catch(async () => {
        const text = await res.text().catch(() => '');
        return { error: text || res.statusText };
      });
      if (!res.ok) throw new Error(data?.error ?? res.statusText ?? `Request failed with status ${res.status}`);
      // Students see upcoming and live meetings
      setMeetings((data.meetings || []).filter((m: any) => m.status !== 'ended' && m.status !== 'cancelled'));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-sky-900">Upcoming Sessions</h1>
        <p className="text-sky-600">Join live or upcoming class sessions for your enrolled subjects.</p>
      </div>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-dashed border-sky-200">
          <Video className="h-12 w-12 text-sky-200" />
          <p className="text-sky-700 font-medium">No upcoming sessions at the moment.</p>
          <p className="text-sky-400 text-sm">Check back later or contact your teacher.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {meetings.map(m => {
            const hasStreamId = Boolean(m.stream_call_id);

            return (
              <div key={m.id} className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 text-base">{m.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[m.status] || ''}`}>
                    {m.status}
                  </span>
                </div>

                {m.subjects?.name && (
                  <p className="text-sm text-sky-600 font-medium">{m.subjects.name}</p>
                )}

                <div className="flex flex-col gap-1 text-xs text-gray-400">
                  {m.scheduled_at && !isNaN(new Date(m.scheduled_at).getTime()) ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(m.scheduled_at).toLocaleString()}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Instant (Started {new Date(m.created_at).toLocaleString()})
                    </span>
                  )}
                  <span>Host: {m.users?.full_name || m.users?.email || 'Unknown'}</span>
                </div>

                <Button
                  size="sm"
                  disabled={!hasStreamId}
                  title={hasStreamId ? undefined : 'This session is not available yet.'}
                  aria-disabled={!hasStreamId}
                  onClick={() => {
                    if (hasStreamId) {
                      router.push(`/meeting/${m.stream_call_id}`);
                    }
                  }}
                  className={`w-full mt-auto gap-2 ${m.status === 'live' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {m.status === 'live' ? 'Join Live Now' : 'View Session'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
