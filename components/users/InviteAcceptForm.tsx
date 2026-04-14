'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import Image from 'next/image';
import { getErrorMessage } from '@/lib/utils';

interface InviteData {
  token: string;
  email: string;
  role: string;
  orgName?: string;
}

export function InviteAcceptForm({ invite }: { invite: InviteData }) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password: password,
      });

      if (authError || !authData.user) {
        throw authError ?? new Error('Failed to create account.');
      }

      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: invite.token,
          fullName: fullName,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const { data: { user } } = await supabase.auth.getUser();

          const cleanupRes = await fetch('/api/auth/delete-user', { 
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.id })
          }).finally(() => clearTimeout(timeoutId));

          if (!cleanupRes.ok) {
            console.error('Failed to clean up orphaned auth user after invite accept error.');
          }
        } catch (cleanupError: any) {
          if (cleanupError.name === 'AbortError') {
            console.warn('Cleanup fetch timed out after 5s');
          } else {
            console.error('Failed to clean up orphaned auth user:', cleanupError);
          }
        }

        throw new Error(body?.error || 'Failed to link profile.');
      }

      toast({
        title: 'Success!',
        description: 'Account created and verified.',
      });
      router.push('/');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Profile Error',
        description: getErrorMessage(error, 'Failed to create account.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-dark-1 p-8 shadow-md text-white">
      <div className="flex items-center gap-2">
        <Image src="/icons/logo.svg" width={32} height={32} alt="logo" />
        <h1 className="text-2xl font-bold">LMS Accept Invite</h1>
      </div>
      
      <p className="text-sm text-gray-300">
        You have been invited to join as a <span className="font-bold text-blue-400 capitalize">{invite.role}</span>.
      </p>

      <form onSubmit={handleAccept} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-email" className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Email Address</label>
          <Input id="invite-email" className="w-full bg-dark-3 border-none text-gray-400" type="email" value={invite.email} disabled />
        </div>
        
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-full-name" className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Full Name</label>
          <Input
            id="invite-full-name"
            className="w-full bg-dark-3 border-none text-white focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-blue-1"
            type="text"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="invite-password" className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Create Password</label>
          <Input
            id="invite-password"
            className="w-full bg-dark-3 border-none text-white focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-blue-1"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        
        <Button 
          type="submit" 
          disabled={loading}
          className="mt-2 bg-blue-1 hover:bg-blue-600 font-bold"
        >
          {loading ? 'Creating Account...' : 'Accept Invite & Join'}
        </Button>
      </form>
    </div>
  );
}
