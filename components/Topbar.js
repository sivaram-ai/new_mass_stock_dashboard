import { Boxes } from 'lucide-react';
import NavLinks from '@/components/NavLinks';
import SignOutButton from '@/components/SignOutButton';
import { canManageItems, isAdmin } from '@/lib/constants';

/**
 * Global header. The signed-in person's name and role sit in the top-left
 * corner on every authenticated page — see app/layout.js.
 */
export default function Topbar({ user }) {
  const role = user.roleName;

  const items = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/items/view', label: 'View Items' },
    ...(canManageItems(role) ? [{ href: '/items/config', label: 'Item Config' }] : []),
    { href: '/history', label: 'History' },
    ...(isAdmin(role) ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  const initials = user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        {/* Top-left: who is signed in, and as what. */}
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
          >
            {initials || <Boxes className="h-4 w-4" />}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
            <p className="truncate text-xs text-slate-500">
              {role ?? <span className="text-red-600">No role assigned</span>}
            </p>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />

        <NavLinks items={items} />

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs font-medium tracking-wide text-slate-400 lg:inline">
            NEW MASS STOCK
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
