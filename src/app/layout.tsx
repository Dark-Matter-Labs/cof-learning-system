import type { Metadata } from 'next';
import { Inter, Crimson_Pro, DM_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { MobileNav } from '@/components/layout/MobileNav';
import { NavBar } from '@/components/layout/NavBar';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson-pro',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'xCO',
  description: 'Expanding Civilisational Optionality — knowledge system by Dark Matter Labs',
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
        className={`${inter.variable} ${crimsonPro.variable} ${dmMono.variable} font-body antialiased`}
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
