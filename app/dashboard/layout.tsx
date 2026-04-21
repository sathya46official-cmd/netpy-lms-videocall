import { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { UserProvider } from '@/components/providers/UserProvider';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/hooks/useUser';
import { Role } from '@/lib/permissions';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Server-side fetching before generating any HTML
  const supabase = createClient();
  let initialUser: UserProfile | null = null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const authUser = session.user;
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (data) {
        initialUser = {
          id: data.id,
          email: data.email || authUser.email || '',
          username: data.full_name || authUser.email?.split('@')[0] || '',
          fullName: data.full_name || '',
          imageUrl: data.avatar_url || `https://getstream.io/random_svg/?id=${data.id}&name=${authUser.email}`,
          role: (data.role as Role) || 'student',
          orgId: data.org_id,
        };
      } else {
        initialUser = {
          id: authUser.id,
          email: authUser.email || '',
          username: authUser.email?.split('@')[0] || '',
          fullName: '',
          imageUrl: `https://getstream.io/random_svg/?id=${authUser.id}&name=${authUser.email}`,
          role: (authUser.user_metadata?.role as Role) || 'student',
          orgId: null,
        };
      }
    }
  } catch (e) {
    console.error('Layout Server Fetch Error', e);
  }

  return (
    <UserProvider initialUser={initialUser}>
      <main className={`relative min-h-screen flex flex-col ${initialUser?.role === 'super_admin' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <Navbar />
        <div className="flex">
          <Sidebar />
          <section className="flex min-h-screen flex-1 flex-col px-6 pb-6 pt-28 max-md:pb-14 sm:px-14">
            <div className="w-full h-full max-w-7xl mx-auto">
              {children}
            </div>
          </section>
        </div>
      </main>
    </UserProvider>
  );
}
