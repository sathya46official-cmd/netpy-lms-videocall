'use client';

import { ReactNode, useEffect, useRef, useState, Component } from 'react';
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk';

import { tokenProvider } from '@/actions/stream.actions';
import Loader from '@/components/Loader';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;

// ── Error Boundary to catch Stream WS errors ──────────────────────────────────
interface EBState { hasError: boolean; message: string }
class StreamErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, EBState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: any): EBState {
    const raw = typeof error === 'string' ? error : error?.message ?? '';
    let message = 'Failed to connect to video service.';
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.StatusCode === 429) {
        message = 'Too many connection attempts. Please wait a moment and try again.';
      } else if (parsed?.message) {
        message = parsed.message;
      }
    } catch { /* raw string error */ }
    return { hasError: true, message };
  }
  componentDidCatch(error: any) {
    console.error('[StreamErrorBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-dark-2 text-white px-6">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-2xl font-bold">Video Connection Error</h2>
          <p className="text-gray-400 text-center max-w-sm">{this.state.message}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              this.props.onReset();
            }}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition-all"
          >
            Retry Connection
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main Provider ─────────────────────────────────────────────────────────────
const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient | undefined>();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [resetKey, setResetKey] = useState(0);

  // Stable ref — cleanup closures always see the latest client
  const clientRef = useRef<StreamVideoClient | undefined>();

  const safeDisconnect = async (client?: StreamVideoClient) => {
    if (!client) return;
    try { await client.disconnectUser(); } catch { /* ignore */ }
  };

  // ── Effect 1: Auth listener — runs ONCE ───────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) setUser(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
      } else {
        safeDisconnect(clientRef.current);
        clientRef.current = undefined;
        setVideoClient(undefined);
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []); // ← empty deps: runs exactly once

  // ── Effect 2: Create Stream client when user changes ──────────────────────
  useEffect(() => {
    if (!user) return;
    if (!API_KEY) {
      console.error('Stream API key is missing');
      return;
    }

    // Prevent creating a duplicate client for the same user
    if (clientRef.current) return;

    const client = new StreamVideoClient({
      apiKey: API_KEY,
      user: {
        id: user.id,
        name: user.email?.split('@')[0] || user.id,
        image: `https://getstream.io/random_svg/?id=${user.id}&name=${user.email}`,
      },
      tokenProvider,
      options: { timeout: 15000 },
    });

    clientRef.current = client;
    setVideoClient(client);

    return () => {
      safeDisconnect(client).catch(() => undefined);
      clientRef.current = undefined;
    };
  }, [user?.id, resetKey]); // ← re-run when user ID actually changes OR manual reset is triggered

  const handleReset = () => {
    // Force full re-init on retry
    safeDisconnect(clientRef.current).catch(() => undefined);
    clientRef.current = undefined;
    setVideoClient(undefined);
    // Re-trigger user effect by bumping reset key which remounts
    setResetKey(k => k + 1);
    // Re-fetch user
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  };

  if (user === undefined) return <Loader />;
  if (user === null) return <>{children}</>;
  if (!videoClient) return <Loader />;

  return (
    <StreamErrorBoundary key={resetKey} onReset={handleReset}>
      <StreamVideo client={videoClient}>{children}</StreamVideo>
    </StreamErrorBoundary>
  );
};

export default StreamVideoProvider;
