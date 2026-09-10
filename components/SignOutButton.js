'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui';

export default function SignOutButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
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
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Sign out
      </button>

      <Modal
        open={confirming}
        // Ignore backdrop/Escape dismissal mid-request, so the dialog cannot
        // vanish while the sign-out is still in flight.
        onClose={() => {
          if (!busy) setConfirming(false);
        }}
        title="Sign out?"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          You will need your email and password to sign back in.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={signOut} loading={busy}>
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
