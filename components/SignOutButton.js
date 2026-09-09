'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    // refresh() clears the cached server-rendered tree; without it the topbar
    // would keep showing the signed-out user's name until a hard reload.
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
