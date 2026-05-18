'use client';

import { useAuth } from './AuthProvider';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getKnowledgeReviewTypes } from '@/lib/config/captureTypes';

interface NavBarProps {
  readonly reviewCount: number;
}

export function NavBar({ reviewCount }: NavBarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [liveCount, setLiveCount] = useState(reviewCount);

  useEffect(() => {
    const supabase = createClient();

    const fetchCount = async () => {
      const [{ count: flaggedCount }, { count: learningsCount }] = await Promise.all([
        supabase
          .from('nodes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'flagged_for_review'),
        supabase
          .from('nodes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'llm_reviewed')
          .in('node_type', getKnowledgeReviewTypes() as string[]),
      ]);
      setLiveCount((flaggedCount ?? 0) + (learningsCount ?? 0));
    };

    const channel = supabase
      .channel('nav-review-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => {
        fetchCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/graph', label: 'Graph' },
    { href: '/portfolios', label: 'Portfolios' },
    { href: '/newsletter', label: 'Intelligence' },
    { href: '/commitments', label: 'Commitments' },
    { href: '/query', label: 'Query' },
    { href: '/review', label: 'Health' },
    { href: '/reflect', label: 'Reflect' },
    { href: '/capture', label: 'Capture' },
    { href: '/settings', label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="font-ui fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cof-bg-elevated/90 backdrop-blur-sm border-b border-cof-border/70">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-sm font-bold text-cof-text-primary tracking-widest">
          xCO
        </Link>
        <div className="flex gap-4">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs transition-colors ${
                isActive(link.href)
                  ? 'text-node-hunch border-b-2 border-node-hunch pb-1'
                  : 'text-cof-text-tertiary hover:text-cof-text-secondary'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {liveCount > 0 && (
          <Link
            href="/review"
            className="bg-node-assumption-fg text-white text-xs px-2.5 py-0.5 rounded-full"
          >
            {liveCount} awaiting review
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-7 h-7 rounded-full bg-cof-bg-subtle flex items-center justify-center text-xs text-cof-text-secondary hover:bg-cof-border transition-colors"
          title={user?.email ?? 'Sign out'}
        >
          {user?.email?.charAt(0).toUpperCase() ?? '?'}
        </button>
      </div>
    </nav>
  );
}
