'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, User } from 'lucide-react';

export default function SuperAdminSchedulePage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? res.statusText ?? `Request failed with status ${res.status}`);
      
      const upcoming = (data?.meetings || []).filter((m: any) => m.status === 'scheduled');
      setMeetings(upcoming);
    } catch (err: any) {
      setMeetings([]);
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
        <h1 className="text-3xl font-bold text-slate-100">Schedule</h1>
        <p className="text-slate-400">All upcoming scheduled sessions across the platform.</p>
      </div>

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 bg-slate-800 rounded-2xl border border-dashed border-slate-600">
          <Calendar className="h-12 w-12 text-slate-600" />
          <p className="text-slate-400 font-medium">No scheduled meetings.</p>
          <p className="text-slate-600 text-sm">Go to Meetings and create a scheduled session.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map(m => {
            const scheduledDate = m.scheduled_at ? new Date(m.scheduled_at) : null;
            const formattedAt = scheduledDate && !Number.isNaN(scheduledDate.getTime())
              ? scheduledDate.toLocaleString()
              : 'TBD';

            return (
              <Card key={m.id} className="bg-slate-800 border-slate-700">
                <CardContent className="pt-5 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-slate-100">{m.title}</p>
                    {m.subjects?.name && <p className="text-sm text-purple-400">{m.subjects.name}</p>}
                    <span className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <Clock className="h-3.5 w-3.5" /> {formattedAt}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <User className="h-3.5 w-3.5" /> {m.users?.full_name || m.users?.email || 'Unknown Host'}
                    </span>
                  </div>
                  <span className="bg-blue-900/50 text-blue-300 text-xs px-3 py-1 rounded-full font-medium">Scheduled</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
