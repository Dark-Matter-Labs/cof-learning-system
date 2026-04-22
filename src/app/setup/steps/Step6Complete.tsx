'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  readonly nodes: Record<string, number>;
  readonly edges: number;
}

export function Step6Complete() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    localStorage.setItem('setup_complete', 'true');
    fetch('/api/setup/stats')
      .then(r => r.json())
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  const totalNodes = stats
    ? Object.values(stats.nodes).reduce((a, b) => a + b, 0)
    : null;

  const enter = () => {
    localStorage.removeItem('setup_step');
    router.push('/');
  };

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <p className="text-4xl">✓</p>
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Your workspace is ready</h1>
      </div>

      {stats && (
        <div className="text-left space-y-1 border border-gray-100 dark:border-gray-800 rounded-xl p-6 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">You&apos;ve set up:</p>
          {(stats.nodes.goal_space ?? 0) > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.goal_space} {stats.nodes.goal_space === 1 ? 'goal' : 'goals'}</p>
          )}
          {(stats.nodes.site ?? 0) > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.site} {stats.nodes.site === 1 ? 'site' : 'sites'}</p>
          )}
          {(stats.nodes.option ?? 0) > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.option} {stats.nodes.option === 1 ? 'option' : 'options'}</p>
          )}
          {(stats.nodes.person ?? 0) > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">• {stats.nodes.person} team {stats.nodes.person === 1 ? 'member' : 'members'}</p>
          )}
          {(totalNodes ?? 0) > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">• {totalNodes} total nodes, {stats.edges} connections</p>
          )}
        </div>
      )}

      <div className="text-left space-y-4 border border-gray-100 dark:border-gray-800 rounded-xl p-6">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">What to do next:</p>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">After your next meeting, capture the key takeaways — the system will connect them to what you already know.</p>
          <p className="text-sm text-gray-500">Check the Query page to ask questions about your knowledge.</p>
          <p className="text-sm text-gray-500">Run a system reflection once a week to see what&apos;s emerging.</p>
        </div>
      </div>

      <button
        onClick={enter}
        className="px-8 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Enter your workspace →
      </button>
    </div>
  );
}
