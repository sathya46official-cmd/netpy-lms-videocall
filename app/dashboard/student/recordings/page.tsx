'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { Video, Play, Clock, Calendar, X } from 'lucide-react';
import RecordingComments from '@/components/RecordingComments';

interface Recording {
  id: string;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  meetings: { id: string; title: string } | null;
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

export default function StudentRecordingsPage() {
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

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

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

  const handlePlay = async (recording: Recording) => {
    setLoadingId(recording.id);
    try {
      const res = await fetch(`/api/recordings/${recording.id}/url`);
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        if (res.status === 404) throw new Error('Recording not found');
        if (res.status === 403) throw new Error('Access denied: You do not have permission to view this recording');
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
          <div className="relative w-full max-w-6xl h-[80vh] bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
            
            {/* Left: Video Player */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-900 shrink-0">
                <p className="text-white font-semibold text-sm truncate">{playingTitle}</p>
                {/* Mobile close button only */}
                <button
                  onClick={() => { setPlayingUrl(null); setPlayingTitle(''); }}
                  className="md:hidden text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={playingUrl}
                  controls
                  autoPlay
                  className="w-full max-h-full"
                  onTimeUpdate={() => {
                    if (!videoRef.current || !loadingId) return;
                    const currentTime = videoRef.current.currentTime;
                    // Send progress every 10 seconds
                    if (Math.floor(currentTime) % 10 === 0 && Math.floor(currentTime) > 0) {
                      fetch(`/api/recordings/${loadingId}/progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          watchedSeconds: Math.floor(currentTime),
                          lastPositionSeconds: Math.floor(currentTime),
                          completed: currentTime >= videoRef.current.duration - 5
                        })
                      }).catch(() => {});
                    }
                  }}
                  onEnded={() => {
                     if (!videoRef.current || !loadingId) return;
                     fetch(`/api/recordings/${loadingId}/progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          watchedSeconds: Math.floor(videoRef.current.currentTime),
                          lastPositionSeconds: Math.floor(videoRef.current.currentTime),
                          completed: true
                        })
                      }).catch(() => {});
                  }}
                />
              </div>
            </div>

            {/* Right: Comments Side Panel */}
            <div className="w-full md:w-[400px] h-full flex flex-col bg-white">
              <div className="hidden md:flex justify-end p-2 bg-gray-50 border-b border-gray-100">
                <button
                  onClick={() => { setPlayingUrl(null); setPlayingTitle(''); }}
                  className="text-gray-500 hover:text-gray-800 transition-colors p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <RecordingComments 
                  recordingId={loadingId!} 
                  onTimestampClick={(seconds) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = seconds;
                      videoRef.current.play().catch(()=>{});
                    }
                  }} 
                />
              </div>
            </div>

          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-sky-900">Recordings</h1>
        <p className="text-sky-600">Rewatch your past class sessions anytime.</p>
      </div>

      {recordings.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 bg-white rounded-2xl border border-dashed border-sky-200">
          <Video aria-hidden="true" className="h-12 w-12 text-sky-200" />
          <p className="text-sky-700 font-medium">No recordings available yet.</p>
          <p className="text-sky-400 text-sm">Recordings from your sessions will appear here after the class ends.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recordings.map(rec => (
            <div key={rec.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
              <div className="w-full h-28 bg-gradient-to-br from-sky-50 to-blue-100 rounded-lg flex items-center justify-center">
                <Video className="h-10 w-10 text-sky-300" />
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                  {rec.meetings?.title ?? 'Class Recording'}
                </p>
                {rec.users?.full_name && (
                  <p className="text-xs text-gray-400">by {rec.users.full_name}</p>
                )}
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(rec.created_at).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(rec.duration_seconds)}
                </span>
              </div>

              <button
                onClick={() => handlePlay(rec)}
                disabled={loadingId === rec.id}
                className="w-full mt-auto flex items-center justify-center gap-2 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                {loadingId === rec.id ? (
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loadingId === rec.id ? 'Loading...' : 'Watch Recording'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
