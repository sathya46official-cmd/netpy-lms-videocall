'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import MeetingCreationForm from '@/components/MeetingCreationForm';
import { useRouter } from 'next/navigation';
import { ExternalLink, Video, Plus } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-red-100 text-red-700 animate-pulse',
  scheduled: 'bg-blue-100 text-blue-700',
  ended: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-yellow-100 text-yellow-700',
};

export default function SuperAdminMeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const fetchMeetings = useCallback(async () => {
    try {
      const r = await fetch('/api/meetings');
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error ?? r.statusText ?? `Request failed with status ${r.status}`);
      setMeetings(data?.meetings || []);
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
      {showForm && (
        <MeetingCreationForm onClose={() => setShowForm(false)} onCreated={fetchMeetings} />
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Meetings</h1>
          <p className="text-slate-400">Create, schedule, and monitor all platform meetings.</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" /> New Meeting
        </Button>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-slate-100">Meeting Log</CardTitle></CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-4">
              <Video className="h-10 w-10 text-slate-600" />
              <p className="text-slate-500">No meetings have been created yet.</p>
              <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <Plus className="h-4 w-4" /> Create your first meeting
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-900">
                  <tr>
                    {['Title', 'Subject', 'Host', 'Type', 'Status', 'Created / Scheduled', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {meetings.map(m => (
                    <tr key={m.id} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-slate-200 font-medium">{m.title}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{m.subjects?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{m.users?.full_name || m.users?.email || 'Unknown Host'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 capitalize">{m.meeting_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[m.status] || 'bg-slate-700 text-slate-400'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {m.scheduled_at && !isNaN(new Date(m.scheduled_at).getTime())
                          ? new Date(m.scheduled_at).toLocaleString()
                          : m.created_at && !isNaN(new Date(m.created_at).getTime())
                            ? new Date(m.created_at).toLocaleDateString()
                            : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {m.status !== 'ended' && m.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!m.stream_call_id}
                            className="border-slate-600 text-slate-300 h-7 disabled:opacity-50"
                            onClick={() => { if (m.stream_call_id) router.push(`/meeting/${m.stream_call_id}`); }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> Join
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
