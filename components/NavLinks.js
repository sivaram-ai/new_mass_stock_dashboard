'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ items }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Main">
      {items.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={[
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
