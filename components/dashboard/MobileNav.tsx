'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Menu, LayoutDashboard, Users, BookOpen, Calendar, Video, Settings, UserPlus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRole } from '@/hooks/useRole';

const routeConfig = {
  super_admin: [
    { label: 'Overview', route: '/dashboard/super-admin', icon: LayoutDashboard },
    { label: 'Organisations', route: '/dashboard/super-admin/organisations', icon: BookOpen },
    { label: 'Platform Users', route: '/dashboard/super-admin/users', icon: Users },
    { label: 'Meetings', route: '/dashboard/super-admin/meetings', icon: Video },
    { label: 'Schedule', route: '/dashboard/super-admin/schedule', icon: Calendar },
    { label: 'Recordings', route: '/dashboard/super-admin/recordings', icon: FileText },
    { label: 'LMS API Docs', route: '/dashboard/super-admin/api-docs', icon: FileText },
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
  ],
};

const themeConfig = {
  super_admin: 'bg-slate-900 text-slate-300',
  org_admin:   'bg-stone-50 text-stone-700',
  staff:       'bg-emerald-50 text-emerald-900',
  student:     'bg-sky-50 text-sky-900',
};

const activeTheme = {
  super_admin: 'bg-slate-700 text-white',
  org_admin:   'bg-stone-200 text-stone-900 font-semibold',
  staff:       'bg-emerald-600 text-white',
  student:     'bg-sky-500 text-white',
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { role } = useRole();

  if (!role) return null;

  const links = routeConfig[role] || [];
  const theme = themeConfig[role] || 'bg-white text-gray-900';
  const activeClass = activeTheme[role] || 'bg-gray-200';

  return (
    <>
      {/* Hamburger button — only visible on mobile */}
      <button
        className="md:hidden flex items-center justify-center p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out Drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          theme,
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-black/10">
          <p className="text-lg font-bold">Netpy LMS</p>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-lg hover:bg-black/10"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-2 p-4 overflow-y-auto">
          <p className="text-xs uppercase tracking-widest font-bold opacity-40 mb-2 px-2">Navigation</p>
          {links.map((link) => {
            const isRootDashboard =
              link.route === '/dashboard/super-admin' ||
              link.route === '/dashboard/org-admin'   ||
              link.route === '/dashboard/staff'       ||
              link.route === '/dashboard/student';

            const isActive = isRootDashboard
              ? pathname === link.route
              : pathname.startsWith(link.route);

            const Icon = link.icon;

            return (
              <Link
                key={link.label}
                href={link.route}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all',
                  isActive ? activeClass : 'hover:bg-black/5',
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
