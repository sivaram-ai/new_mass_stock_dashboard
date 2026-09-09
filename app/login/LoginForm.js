'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Field, Input } from '@/components/ui';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      // Supabase returns the same message for a bad password and an unknown
      // address, which is the behaviour we want — don't leak which it was.
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Wrong email or password.'
          : signInError.message
      );
      setBusy(false);
      return;
    }

    const next = searchParams.get('next');
    router.replace(next && next.startsWith('/') ? next : '/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@newmass.com"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </Field>

      <Alert>{error}</Alert>

      <Button type="submit" size="lg" loading={busy} className="w-full justify-center">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
