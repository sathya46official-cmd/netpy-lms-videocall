'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Play, Clock, Calendar, X, Download, User } from 'lucide-react';

interface Recording {
  id: string;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  meetings: { id: string; title: string; scheduled_at: string | null } | null;
  users: { full_name: string | null; email: string } | null;
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '—';
  if (totalSeconds === 0) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function SuperAdminRecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingTitle, setPlayingTitle] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await fetch('/api/recordings');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load recordings');
      setRecordings(data.recordings ?? []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlayingUrl(null);
        setPlayingTitle('');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!playingUrl && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
  }, [playingUrl]);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  const handlePlay = async (recording: Recording) => {
    setLoadingId(recording.id);
    try {
      const res = await fetch(`/api/recordings/${recording.id}/url`);
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        if (res.status === 404) throw new Error('Recording not found');
        if (res.status === 403) throw new Error('Access denied: Unauthorized access to this recording');
        throw new Error(data?.error ?? 'Failed to get playback URL');
      }
      
      setPlayingUrl(data.url);
      setPlayingTitle(recording.meetings?.title ?? 'Recording');
    } catch (err: any) {
      toast({ title: 'Playback Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader /></div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Video Player Modal */}
      {playingUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-900">
              <p className="text-white font-semibold text-sm truncate">{playingTitle}</p>
              <button
                onClick={() => { setPlayingUrl(null); setPlayingTitle(''); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <video ref={videoRef} src={playingUrl} controls autoPlay className="w-full max-h-[70vh] bg-black" />
            <div className="flex gap-2 p-3 bg-gray-900 justify-end">
              <a
                href={playingUrl}
                download
                className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors px-3 py-1.5 rounded-lg border border-purple-800 hover:bg-purple-900/30"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-slate-100">Platform Recordings</h1>
        <p className="text-slate-400">All recorded sessions across the platform.</p>
      </div>

      {recordings.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="flex flex-col items-center py-20 gap-3">
            <Video className="h-12 w-12 text-slate-600" />
            <p className="text-slate-400 font-medium">No recordings yet.</p>
            <p className="text-slate-600 text-sm">Recordings will appear here after sessions are recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader><CardTitle className="text-slate-100">All Recordings ({recordings.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-900">
                  <tr>
                    {['Meeting', 'Host', 'Duration', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {recordings.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-slate-200 font-medium">
                        {rec.meetings?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {rec.users?.full_name || rec.users?.email || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(rec.duration_seconds)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(rec.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handlePlay(rec)}
                          disabled={loadingId === rec.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-60"
                        >
                          {loadingId === rec.id
                            ? <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <Play className="h-3.5 w-3.5" />
                          }
                          {loadingId === rec.id ? 'Loading...' : 'Play'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
