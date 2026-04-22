'use client';

import { useState, useRef, useCallback } from 'react';
import type { Node } from '@/lib/types/nodes';
import { NodeCard } from './NodeCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  nodeIds: string[];
}

interface AskModeProps {
  readonly allNodes: Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>[];
}

export function AskMode({ allNodes }: AskModeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const referencedNodeIds = new Set(messages.flatMap(m => m.nodeIds));
  const referencedNodes = allNodes.filter(n => referencedNodeIds.has(n.id));

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || isStreaming) return;

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: query, nodeIds: [] }]);
    setInput('');
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', nodeIds: [] }]);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      });

      if (!res.ok) throw new Error('Query failed');

      const contextNodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: current, nodeIds: contextNodeIds };
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          nodeIds: [],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [input, isStreaming, messages]);

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 pt-8 text-center">
              Ask anything about the knowledge graph
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-sm bg-node-hunch/10 border border-node-hunch/20 rounded-xl px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                  {msg.content}
                </div>
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && (
                    <span className="animate-pulse">▋</span>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={isStreaming}
            className="flex-1 text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-indigo-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 text-sm bg-node-hunch text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isStreaming ? '…' : 'Ask'}
          </button>
        </form>
      </div>

      {referencedNodes.length > 0 && panelOpen && (
        <div className="w-56 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Referenced nodes
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ›
            </button>
          </div>
          <div className="space-y-2">
            {referencedNodes.map(n => (
              <NodeCard key={n.id} node={n} />
            ))}
          </div>
        </div>
      )}
      {referencedNodes.length > 0 && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Show referenced nodes"
          className="w-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 border-l border-gray-200 dark:border-gray-800"
        >
          ‹
        </button>
      )}
    </div>
  );
}
