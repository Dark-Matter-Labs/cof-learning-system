'use client';

import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavBarProps {
  readonly reviewCount: number;
}

export function NavBar({ reviewCount }: NavBarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const links = [
    { href: '/', label: 'Graph' },
    { href: '/capture', label: 'Capture' },
    { href: '/review', label: 'Review' },
    { href: '/settings', label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-sm font-bold text-gray-300 tracking-widest">
          COF
        </Link>
        <div className="flex gap-4">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs transition-colors ${
                isActive(link.href)
                  ? 'text-node-hunch border-b-2 border-node-hunch pb-1'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {reviewCount > 0 && (
          <Link
            href="/review"
            className="bg-node-assumption-fg text-white text-xs px-2.5 py-0.5 rounded-full"
          >
            {reviewCount} awaiting review
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          title={user?.email ?? 'Sign out'}
        >
          {user?.email?.charAt(0).toUpperCase() ?? '?'}
        </button>
      </div>
    </nav>
  );
}
