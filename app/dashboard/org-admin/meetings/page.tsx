'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import MeetingCreationForm from '@/components/MeetingCreationForm';
import { Plus, Video, Calendar, Clock, ExternalLink } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-red-100 text-red-700 animate-pulse',
  scheduled: 'bg-blue-100 text-blue-700',
  ended: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-yellow-100 text-yellow-700',
};

export default function OrgAdminMeetingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? res.statusText ?? `Request failed with status ${res.status}`);
      setMeetings(data?.meetings || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const joinMeeting = (callId: string) => router.push(`/meeting/${callId}`);

  if (isLoading) return <div className="flex justify-center p-12"><Loader /></div>;

  return (
    <div className="flex flex-col gap-6">
      {showForm && (
        <MeetingCreationForm onClose={() => setShowForm(false)} onCreated={fetchMeetings} />
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Meetings</h1>
          <p className="text-stone-500">Manage and launch live class sessions for your organisation.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-stone-700 hover:bg-stone-800 text-white gap-2">
          <Plus className="h-4 w-4" /> New Meeting
        </Button>
      </div>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-dashed border-stone-200">
          <Video className="h-12 w-12 text-stone-300" />
          <p className="text-stone-500 font-medium">No meetings yet.</p>
          <Button onClick={() => setShowForm(true)} className="bg-stone-700 hover:bg-stone-800 text-white gap-2">
            <Plus className="h-4 w-4" /> Create your first meeting
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {meetings.map(m => {
            const hasStreamId = Boolean(m.stream_call_id);
            return (
              <div
                key={m.id}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{m.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[m.status] || 'bg-gray-100 text-gray-500'}`}>
                    {m.status}
                  </span>
                </div>

                {m.subjects?.name && (
                  <p className="text-sm text-blue-600 font-medium">{m.subjects.name}</p>
                )}

                <div className="flex flex-col gap-1 text-xs text-gray-400">
                  {m.scheduled_at ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />{new Date(m.scheduled_at).toLocaleString()}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />{new Date(m.created_at).toLocaleString()}
                    </span>
                  )}
                  <span>Host: {m.users?.full_name || m.users?.email || 'Unknown Host'}</span>
                </div>

                {m.status !== 'ended' && m.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    disabled={!hasStreamId}
                    title={hasStreamId ? undefined : 'This meeting does not have a Stream call yet.'}
                    onClick={() => { if (hasStreamId) joinMeeting(m.stream_call_id); }}
                    className={`w-full mt-auto gap-2 ${m.status === 'live' ? 'bg-red-500 hover:bg-red-600' : 'bg-stone-600 hover:bg-stone-700'} text-white disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {m.status === 'live' ? 'Join Live' : 'Open Meeting'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
