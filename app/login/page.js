import { Suspense } from 'react';
import { Boxes } from 'lucide-react';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in · New Mass Stock' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white">
            <Boxes className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">New Mass Stock</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage inventory</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Accounts are created by an administrator.
        </p>
      </div>
    </div>
  );
}
