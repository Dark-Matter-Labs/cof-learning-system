'use client';

import Link from 'next/link';

interface SidebarStats {
  readonly awaitingReview: number;
  readonly promotedThisWeek: number;
  readonly activeTests: number;
}

interface DashboardSidebarProps {
  readonly stats: SidebarStats;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

export function DashboardSidebar({ stats, isOpen, onToggle }: DashboardSidebarProps) {
  return (
    <div className="absolute left-0 top-0 bottom-0 z-30 flex">
      {/* Panel */}
      {isOpen && (
        <div className="w-56 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm border-r border-gray-200/50 dark:border-gray-800/50 pt-[49px] pb-4 px-4 flex flex-col gap-4">
          <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase tracking-widest pt-3">Overview</div>

          <Link href="/review" className="group block">
            <div className="text-2xl font-bold text-node-assumption-fg">{stats.awaitingReview}</div>
            <div className="text-xs text-gray-600 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-400">Awaiting Review</div>
          </Link>

          <div>
            <div className="text-2xl font-bold text-node-assumption-bg">{stats.promotedThisWeek}</div>
            <div className="text-xs text-gray-600 dark:text-gray-500">Promoted This Week</div>
          </div>

          <div>
            <div className="text-2xl font-bold text-node-test">{stats.activeTests}</div>
            <div className="text-xs text-gray-600 dark:text-gray-500">Active Tests</div>
          </div>
        </div>
      )}

      {/* Toggle tab */}
      <button
        onClick={onToggle}
        aria-label="toggle sidebar"
        className="absolute top-[57px] w-5 h-10 bg-gray-200/80 hover:bg-gray-300 dark:bg-gray-800/80 dark:hover:bg-gray-700 rounded-r flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        style={{ left: isOpen ? '224px' : '0px', transition: 'left 0.2s ease' }}
      >
        <span className="text-[10px]">{isOpen ? '‹' : '›'}</span>
      </button>
    </div>
  );
}
