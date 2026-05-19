'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  readonly children: string;
  readonly className?: string;
}

export function Markdown({ children, className = '' }: MarkdownProps) {
  return (
    <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children: c }) => <h1 className="text-sm font-semibold text-cof-text-primary mt-3 mb-1 first:mt-0">{c}</h1>,
        h2: ({ children: c }) => <h2 className="text-xs font-semibold text-cof-text-primary mt-3 mb-1 first:mt-0">{c}</h2>,
        h3: ({ children: c }) => <h3 className="text-xs font-medium text-cof-text-secondary mt-2 mb-0.5 first:mt-0">{c}</h3>,
        p:  ({ children: c }) => <p className="text-xs text-cof-text-secondary leading-relaxed mb-2 last:mb-0">{c}</p>,
        ul: ({ children: c }) => <ul className="list-disc list-outside pl-4 space-y-0.5 mb-2 last:mb-0">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-2 last:mb-0">{c}</ol>,
        li: ({ children: c }) => <li className="text-xs text-cof-text-secondary leading-relaxed">{c}</li>,
        strong: ({ children: c }) => <strong className="font-semibold text-cof-text-primary">{c}</strong>,
        em: ({ children: c }) => <em className="italic text-cof-text-secondary">{c}</em>,
        code: ({ children: c }) => <code className="text-[10px] font-mono bg-cof-bg-subtle border border-cof-border rounded px-1 py-0.5 text-cof-text-secondary">{c}</code>,
        blockquote: ({ children: c }) => <blockquote className="border-l-2 border-cof-border pl-3 my-2 text-cof-text-tertiary italic">{c}</blockquote>,
        hr: () => <hr className="border-cof-border my-3" />,
        a: ({ href, children: c }) => <a href={href} className="text-node-learning underline hover:opacity-80" target="_blank" rel="noopener noreferrer">{c}</a>,
      }}
    >
      {children}
    </ReactMarkdown>
    </div>
  );
}
