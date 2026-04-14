'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Copy, ShieldCheck, Users } from 'lucide-react';

import Loader from '@/components/Loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  org_admin: 'bg-blue-100 text-blue-800',
  staff: 'bg-emerald-100 text-emerald-800',
  student: 'bg-sky-100 text-sky-800',
};

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ orgs: 0, users: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const getJsonOrThrow = async (response: Response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? response.statusText ?? `Request failed with status ${response.status}`);
      }
      return data;
    };

    Promise.all([
      fetch('/api/users').then(getJsonOrThrow),
      fetch('/api/organisations').then(getJsonOrThrow),
    ])
      .then(([usersData, orgData]) => {
        setUsers(usersData.users || []);
        setOrgs(orgData.organisations || []);
        setStats({
          orgs: orgData.organisations?.length || 0,
          users: usersData.users?.length || 0,
        });
        setLoadError('');
      })
      .catch((error) => {
        console.error('Failed to load super admin dashboard data:', error);
        const message = error instanceof Error ? error.message : 'Failed to load dashboard data.';
        setLoadError(message);
        toast({ title: 'Error', description: message, variant: 'destructive' });
      })
      .finally(() => setIsLoading(false));
  }, [toast]);

  const handleInviteAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteOrgId) return;

    setIsInviting(true);
    setInviteLink('');

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: 'org_admin', orgId: inviteOrgId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to create invite');
      }

      if (data?.inviteUrl) {
        const fullInviteLink = `${window.location.origin}${data.inviteUrl}`;
        setInviteLink(fullInviteLink);
        toast({ title: 'Invite created!', description: 'Copy the link below and share it securely.' });
      } else {
        throw new Error('Unexpected response: Invite URL missing from server.');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invite.',
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: 'Copied!', description: 'Invite link copied to clipboard.' });
    } catch (error) {
      console.error('Failed to copy invite link:', error);
      toast({ title: 'Copy failed', description: 'Could not copy invite link.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader /></div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Platform Overview</h1>
        <p className="mt-1 text-slate-400">Super Admin - full platform visibility and control.</p>
        {loadError && <p className="mt-2 text-sm text-red-300">{loadError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="rounded-lg bg-purple-500/20 p-3"><ShieldCheck className="h-6 w-6 text-purple-400" /></div>
          <div>
            <p className="text-sm text-slate-400">Super Admins</p>
            <p className="text-3xl font-bold text-white">{users.filter((user) => user.role === 'super_admin').length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="rounded-lg bg-blue-500/20 p-3"><Building2 className="h-6 w-6 text-blue-400" /></div>
          <div>
            <p className="text-sm text-slate-400">Organisations</p>
            <p className="text-3xl font-bold text-white">{stats.orgs}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="rounded-lg bg-emerald-500/20 p-3"><Users className="h-6 w-6 text-emerald-400" /></div>
          <div>
            <p className="text-sm text-slate-400">Total Users</p>
            <p className="text-3xl font-bold text-white">{stats.users}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="border-slate-700 bg-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="text-slate-100">All Platform Users</CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-slate-500">No users yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Org</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {users.map((user: any) => {
                        const safeRole = user.role ? user.role.replace(/_/g, ' ') : '';

                        return (
                          <tr key={user.id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3 text-sm text-slate-200">{user.full_name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-slate-400">{user.email}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[user.role] || ''}`}>
                                {safeRole}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400">{user.organisations?.name || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="border-slate-700 bg-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="text-slate-100">Invite Org Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteAdmin} className="space-y-4">
                <div>
                  <label htmlFor="invite-email" className="mb-1 block text-sm text-slate-400">Email</label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="admin@platform.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                    disabled={isInviting}
                  />
                </div>
                <div>
                  <label htmlFor="invite-org" className="mb-1 block text-sm text-slate-400">Organisation</label>
                  <select
                    id="invite-org"
                    value={inviteOrgId}
                    onChange={(e) => setInviteOrgId(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                    disabled={isInviting}
                  >
                    <option value="">Select an org...</option>
                    {orgs.map((org: any) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={isInviting || !inviteEmail || !inviteOrgId} className="w-full bg-purple-600 hover:bg-purple-700">
                  {isInviting ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </form>

              {inviteLink && (
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <p className="mb-2 text-xs text-slate-400">Share this link securely:</p>
                  <p className="mb-3 break-all text-xs text-emerald-400">{inviteLink}</p>
                  <Button size="sm" variant="outline" className="w-full border-slate-600" onClick={copyLink}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
