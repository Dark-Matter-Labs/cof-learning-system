'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/portfolios', label: 'Portfolios', icon: '◎' },
  { href: '/graph', label: 'Graph', icon: '🕸' },
  { href: '/capture', label: 'Capture', icon: '＋' },
  { href: '/query', label: 'Query', icon: '💬' },
  { href: '/', label: 'Home', icon: '⌂' },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-cof-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors
            ${isActive(item.href)
              ? 'text-node-hunch'
              : 'text-cof-text-tertiary hover:text-cof-text-secondary'
            }
            ${item.label === 'Capture' ? 'relative' : ''}`}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.label === 'Capture' ? (
            <span className="w-10 h-10 rounded-full bg-node-hunch text-white flex items-center justify-center text-lg font-light -mt-4 shadow-lg">
              {item.icon}
            </span>
          ) : (
            <span className="text-xl leading-none">{item.icon}</span>
          )}
          <span className="text-[10px] font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
