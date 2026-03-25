import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { NavBar } from '@/components/layout/NavBar';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'COF Learning System',
  description: 'Visual operating system for the Civilization Options Fund',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get review count for nav badge
  let reviewCount = 0;
  if (user) {
    const { count } = await supabase
      .from('nodes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'llm_reviewed');
    reviewCount = count ?? 0;
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-gray-950 text-gray-100`}>
        <AuthProvider initialUser={user}>
          {user && <NavBar reviewCount={reviewCount} />}
          <main className="h-screen overflow-hidden">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
