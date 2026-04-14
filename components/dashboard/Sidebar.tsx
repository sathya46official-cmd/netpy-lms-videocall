'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useRole } from '@/hooks/useRole';
import { LayoutDashboard, Users, BookOpen, Calendar, Video, Settings, UserPlus, FileText } from 'lucide-react';

const routeConfig = {
  super_admin: [
    { label: 'Overview', route: '/dashboard/super-admin', icon: LayoutDashboard },
    { label: 'Organisations', route: '/dashboard/super-admin/organisations', icon: BookOpen },
    { label: 'Platform Users', route: '/dashboard/super-admin/users', icon: Users },
    { label: 'Meetings', route: '/dashboard/super-admin/meetings', icon: Video },
    { label: 'Schedule', route: '/dashboard/super-admin/schedule', icon: Calendar },
    { label: 'Recordings', route: '/dashboard/super-admin/recordings', icon: FileText },
    { label: 'Settings', route: '/dashboard/super-admin/settings', icon: Settings },
  ],
  org_admin: [
    { label: 'Overview', route: '/dashboard/org-admin', icon: LayoutDashboard },
    { label: 'Meetings', route: '/dashboard/org-admin/meetings', icon: Video },
    { label: 'Schedule', route: '/dashboard/org-admin/schedule', icon: Calendar },
    { label: 'Recordings', route: '/dashboard/org-admin/recordings', icon: FileText },
    { label: 'Staff Directory', route: '/dashboard/org-admin/staff', icon: UserPlus },
    { label: 'Students', route: '/dashboard/org-admin/students', icon: Users },
    { label: 'Batches / Classes', route: '/dashboard/org-admin/batches', icon: BookOpen },
    { label: 'Subjects', route: '/dashboard/org-admin/subjects', icon: FileText },
    { label: 'Settings', route: '/dashboard/org-admin/settings', icon: Settings },
  ],
  staff: [
    { label: 'My Classes', route: '/dashboard/staff', icon: LayoutDashboard },
    { label: 'Schedule', route: '/dashboard/staff/schedule', icon: Calendar },
    { label: 'My Students', route: '/dashboard/staff/students', icon: Users },
    { label: 'Meetings', route: '/dashboard/staff/meetings', icon: Video },
    { label: 'Recordings', route: '/dashboard/staff/recordings', icon: FileText },
  ],
  student: [
    { label: 'Home', route: '/dashboard/student', icon: LayoutDashboard },
    { label: 'Upcoming', route: '/dashboard/student/meetings', icon: Calendar },
    { label: 'Subjects', route: '/dashboard/student/subjects', icon: BookOpen },
    { label: 'My Doubts', route: '/dashboard/student/doubts', icon: FileText },
    { label: 'Recordings', route: '/dashboard/student/recordings', icon: Video },
  ]
};

const themeConfig = {
  super_admin: 'bg-slate-900 border-r border-slate-800 text-slate-300',
  org_admin: 'bg-stone-50 border-r border-stone-200 text-stone-600',
  staff: 'bg-emerald-50 border-r border-emerald-100 text-emerald-800',
  student: 'bg-sky-50 border-r border-sky-100 text-sky-800'
};

const activeTheme = {
  super_admin: 'bg-slate-800 text-white',
  org_admin: 'bg-stone-200 text-stone-900 font-semibold',
  staff: 'bg-emerald-600 text-white shadow-md',
  student: 'bg-sky-500 text-white shadow-sm'
};

export function Sidebar() {
  const pathname = usePathname();
  const { role, isLoaded } = useRole();

  if (!isLoaded || !role) return <div className="w-64 shrink-0 h-screen bg-gray-100 animate-pulse border-r max-md:hidden" />;

  const links = routeConfig[role] || [];
  const theme = themeConfig[role] || 'bg-gray-100';
  const activeClass = activeTheme[role] || 'bg-gray-200';

  return (
    <aside className={cn('sticky left-0 top-0 flex h-screen flex-col justify-between pt-28 px-6 pb-12 w-64 shrink-0 max-md:hidden', theme)}>
      <div className="flex flex-1 flex-col gap-4">
        <h2 className="text-xs uppercase tracking-widest font-bold opacity-50 mb-4 px-2">Navigation</h2>
        {links.map((link) => {
          const isActive = pathname === link.route || (pathname.startsWith(`${link.route}/`) && link.route.length > 10);
          const Icon = link.icon;

          return (
            <Link
              key={link.label}
              href={link.route}
              className={cn(
                'flex gap-4 items-center p-3 rounded-lg justify-start font-medium transition-all hover:opacity-80',
                isActive ? activeClass : 'hover:bg-black/5 hover:dark:bg-white/5'
              )}
            >
              <Icon className="w-5 h-5" />
              <p className="text-sm">{link.label}</p>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
