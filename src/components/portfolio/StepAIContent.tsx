import { Markdown } from '@/components/ui/Markdown';

interface StepAIContentProps {
  readonly agentName: string;
  readonly content: string;
}

export function StepAIContent({ agentName, content }: StepAIContentProps) {
  return (
    <div className="bg-cof-bg-subtle border border-cof-border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-node-hunch font-semibold uppercase tracking-wider">
          ✦ AI Draft
        </span>
        <span className="text-[10px] text-cof-text-tertiary">— {agentName}</span>
      </div>
      <Markdown>{content}</Markdown>
    </div>
  );
}
