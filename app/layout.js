import './globals.css';
import Topbar from '@/components/Topbar';
import { getCurrentUser } from '@/lib/auth';

export const metadata = {
  title: 'New Mass Stock Dashboard',
  description: 'Role-based inventory management for New Mass',
};

/**
 * Root layout. Reads the session once per request so the header can show the
 * signed-in person's name and role in the top-left corner of every page.
 * Signed-out routes (/login) render without the header.
 */
export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="min-h-screen">
        {user && <Topbar user={user} />}
        <main className={user ? 'mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6' : ''}>
          {children}
        </main>
      </body>
    </html>
  );
}
