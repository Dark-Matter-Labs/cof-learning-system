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

interface NavLink {
  readonly href: string;
  readonly label: string;
}

const PRIMARY_LINKS: readonly NavLink[] = [
  { href: '/capture', label: 'Capture' },
  { href: '/review', label: 'Review' },
  { href: '/graph', label: 'Graph' },
  { href: '/query', label: 'Ask' },
  { href: '/reflect', label: 'Reflect' },
  { href: '/commitments', label: 'Commitments' },
];

const SECONDARY_LINKS: readonly NavLink[] = [
  { href: '/portfolios', label: 'Portfolios' },
  { href: '/newsletter', label: 'Intelligence' },
  { href: '/', label: 'Dashboard' },
];

const ALL_LINKS: readonly NavLink[] = [...PRIMARY_LINKS, ...SECONDARY_LINKS];

export function NavBar({ reviewCount }: NavBarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [liveCount, setLiveCount] = useState(reviewCount);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close menus on route change and on Escape.
  useEffect(() => { setMoreOpen(false); setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMoreOpen(false); setMobileOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const moreActive = SECONDARY_LINKS.some(l => isActive(l.href));

  const linkClass = (active: boolean) =>
    `text-xs transition-colors ${
      active
        ? 'text-node-hunch border-b-2 border-node-hunch pb-1'
        : 'text-cof-text-tertiary hover:text-cof-text-secondary'
    }`;

  return (
    <nav className="font-ui fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cof-bg-elevated/90 backdrop-blur-sm border-b border-cof-border/70">
      <div className="flex items-center gap-8 min-w-0">
        <Link href="/" className="text-sm font-bold text-cof-text-primary tracking-widest">
          xCO
        </Link>

        {/* Desktop primary links + More popover */}
        <div className="hidden sm:flex gap-4 items-center">
          {PRIMARY_LINKS.map(link => (
            <Link key={link.href} href={link.href} className={linkClass(isActive(link.href))}>
              {link.label}
            </Link>
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen(o => !o)}
              aria-expanded={moreOpen}
              className={`${linkClass(moreActive)} inline-flex items-center gap-0.5`}
            >
              More
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="absolute left-0 mt-3 z-50 min-w-[150px] bg-cof-bg-elevated border border-cof-border rounded-lg py-1 shadow-lg">
                  {SECONDARY_LINKS.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className={`block px-3 py-1.5 text-xs transition-colors ${
                        isActive(link.href) ? 'text-node-hunch' : 'text-cof-text-secondary hover:text-cof-text-primary hover:bg-cof-bg-subtle'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {liveCount > 0 && (
          <Link
            href="/review"
            className="bg-node-assumption-fg text-white text-xs px-2.5 py-0.5 rounded-full"
          >
            {liveCount} to review
          </Link>
        )}

        {/* Desktop: settings gear + avatar */}
        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          className="hidden sm:inline-flex w-7 h-7 rounded-full items-center justify-center text-cof-text-tertiary hover:text-cof-text-secondary hover:bg-cof-bg-subtle transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <button
          onClick={handleSignOut}
          className="hidden sm:flex w-7 h-7 rounded-full bg-cof-bg-subtle items-center justify-center text-xs text-cof-text-secondary hover:bg-cof-border transition-colors"
          title={user?.email ?? 'Sign out'}
        >
          {user?.email?.charAt(0).toUpperCase() ?? '?'}
        </button>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="sm:hidden inline-flex w-8 h-8 rounded items-center justify-center text-cof-text-secondary hover:bg-cof-bg-subtle"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="sm:hidden fixed inset-0 top-[49px] z-40 cursor-default"
            onClick={() => setMobileOpen(false)}
          />
          <div className="sm:hidden absolute top-full left-0 right-0 z-50 bg-cof-bg-elevated border-b border-cof-border flex flex-col py-2">
            {ALL_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-6 py-2.5 text-sm transition-colors ${
                  isActive(link.href) ? 'text-node-hunch' : 'text-cof-text-secondary hover:bg-cof-bg-subtle'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={`px-6 py-2.5 text-sm transition-colors ${
                isActive('/settings') ? 'text-node-hunch' : 'text-cof-text-secondary hover:bg-cof-bg-subtle'
              }`}
            >
              Settings
            </Link>
            <button
              onClick={() => { setMobileOpen(false); void handleSignOut(); }}
              className="px-6 py-2.5 text-sm text-left text-cof-text-tertiary hover:bg-cof-bg-subtle"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
