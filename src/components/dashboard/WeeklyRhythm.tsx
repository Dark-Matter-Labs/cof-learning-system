import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { RhythmData } from '@/lib/dashboard/queries';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F'] as const;

export function WeeklyRhythm({ rhythm }: { readonly rhythm: RhythmData }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-cof-text-tertiary mb-4">
        This week's rhythm
      </p>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-cof-text-secondary mb-2">Daily capture</p>
          <div className="flex gap-2">
            {rhythm.dailyCaptures.map((done, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  data-day-dot
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs transition-colors
                    ${i === rhythm.todayIndex ? 'ring-2 ring-node-hunch/30' : ''}
                    ${done ? 'bg-node-hunch border-node-hunch text-white' : 'border-cof-border text-transparent'}`}
                >
                  ✓
                </div>
                <span className="text-[10px] text-cof-text-tertiary">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[
            { done: rhythm.weeklyReviewDone, label: 'Weekly review (Fri)', href: '/review' },
            { done: rhythm.monthlyReflectionDone, label: 'Monthly reflection', href: '/reflect' },
          ].map(({ done, label, href }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0
                ${done ? 'bg-node-hunch border-node-hunch text-white' : 'border-cof-border-strong'}`}>
                {done ? '✓' : ''}
              </span>
              <Link href={href} className="text-xs text-cof-text-secondary hover:text-cof-text-primary transition-colors">
                {label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
