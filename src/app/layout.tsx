import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { MobileNav } from '@/components/layout/MobileNav';
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

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;if(window.matchMedia('(prefers-color-scheme: dark)').matches){d.classList.add('dark')}else{d.classList.remove('dark')}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif4.variable} font-sans antialiased`}
        style={{ background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
      >
        <AuthProvider initialUser={user}>
          {user && <NavBar reviewCount={reviewCount} />}
          <main className="h-screen overflow-y-auto pt-[49px] pb-16 lg:pb-0">
            {children}
          </main>
          {user && <MobileNav />}
        </AuthProvider>
      </body>
    </html>
  );
}
