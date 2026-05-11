'use client';

import { useState, useRef, useMemo } from 'react';
import type { Node } from '@/lib/types/nodes';
import { NodeCard } from './NodeCard';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { Spinner } from '@/components/ui/Spinner';

interface Message {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly nodeIds: readonly string[];
  readonly savedNodeId?: string;
  readonly sessionId?: string;
}

interface AskModeProps {
  readonly allNodes: ReadonlyArray<Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>>;
}

type SaveNodeType = 'hunch' | 'learning';

interface SaveState {
  readonly messageId: number;
  readonly title: string;
  readonly nodeType: SaveNodeType;
  readonly saving: boolean;
  readonly saveError: string | null;
}

export function AskMode({ allNodes }: AskModeProps) {
  const nextId = useRef(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const referencedNodeIds = useMemo(
    () => new Set(messages.flatMap(m => m.nodeIds)),
    [messages]
  );
  const referencedNodes = useMemo(
    () => allNodes.filter(n => referencedNodeIds.has(n.id)),
    [allNodes, referencedNodeIds]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || isStreaming) return;

    const ERROR_MESSAGE = 'Something went wrong. Please try again.';
    const history = messages
      .filter(m => m.content !== ERROR_MESSAGE)
      .map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { id: nextId.current++, role: 'user', content: query, nodeIds: [] }]);
    setInput('');
    setIsStreaming(true);
    setMessages(prev => [...prev, { id: nextId.current++, role: 'assistant', content: '', nodeIds: [] }]);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      });

      if (!res.ok) throw new Error('Query failed');

      let contextNodeIds: string[] = [];
      try {
        contextNodeIds = JSON.parse(res.headers.get('X-Context-Nodes') ?? '[]') as string[];
      } catch {
        // non-fatal: proceed without node references
      }

      const querySessionId = res.headers.get('X-Query-Session-Id') ?? undefined;

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      try {
        let accumulated = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: current, nodeIds: contextNodeIds };
            return updated;
          });
        }
        if (querySessionId) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], sessionId: querySessionId };
            return updated;
          });
        }
      } catch (streamErr) {
        reader.cancel();
        throw streamErr;
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Something went wrong. Please try again.',
          nodeIds: [],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function openSaveForm(message: Message) {
    const firstLine = message.content.split('\n')[0].trim().slice(0, 150);
    setSaveState({ messageId: message.id, title: firstLine || 'New learning', nodeType: 'learning', saving: false, saveError: null });
  }

  async function handleSave(message: Message) {
    const snapshot = saveState;
    if (!snapshot) return;
    setSaveState(s => s ? { ...s, saving: true, saveError: null } : null);

    try {
      const res = await fetch('/api/query/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: snapshot.title,
          content: message.content,
          node_type: snapshot.nodeType,
          context_node_ids: [...message.nodeIds],
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const body = await res.json() as { data?: { node?: { id?: string } } };
      const nodeId = body.data?.node?.id;
      if (!nodeId) throw new Error('Unexpected response');
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, savedNodeId: nodeId } : m
      ));
      setSaveState(null);
    } catch {
      setSaveState(s => s ? { ...s, saving: false, saveError: 'Save failed — please try again.' } : null);
    }
  }

  const nodesByType = useMemo(
    () => referencedNodes.reduce<Record<string, typeof referencedNodes>>((acc, n) => {
      const key = n.node_type.replace(/_/g, ' ');
      return { ...acc, [key]: [...(acc[key] ?? []), n] };
    }, {}),
    [referencedNodes]
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <p className="text-sm text-cof-text-tertiary pt-8 text-center">
              Ask anything about the knowledge graph
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-sm bg-node-hunch/10 border border-node-hunch/20 rounded-xl px-4 py-2 text-sm text-cof-text-primary">
                  {msg.content}
                </div>
              ) : (
                <div>
                  <div className="text-sm text-cof-text-secondary leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                    {isStreaming && msg.id === messages[messages.length - 1]?.id && (
                      <span className="animate-pulse">▋</span>
                    )}
                  </div>

                  {msg.content && !isStreaming && (
                    <div className="mt-2">
                      {msg.savedNodeId ? (
                        <a
                          href={`/capture/${msg.savedNodeId}`}
                          className="text-xs text-node-hunch hover:underline"
                        >
                          Saved to graph →
                        </a>
                      ) : saveState?.messageId === msg.id ? (

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <input
                            type="text"
                            value={saveState.title}
                            onChange={e => setSaveState(s => s ? { ...s, title: e.target.value, saveError: null } : null)}
                            placeholder="Node title…"
                            className="text-xs bg-cof-bg-elevated border border-cof-border rounded px-2 py-1 text-cof-text-primary w-56 focus:outline-none focus:border-node-hunch"
                          />
                          <div className="flex gap-1">
                            {(['learning', 'hunch'] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setSaveState(s => s ? { ...s, nodeType: t } : null)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${saveState.nodeType === t ? 'border-node-hunch bg-node-hunch/10 text-node-hunch' : 'border-cof-border text-cof-text-tertiary'}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={!saveState.title.trim() || saveState.saving}
                            onClick={() => handleSave(msg)}
                            className="text-xs px-3 py-1 bg-node-hunch text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
                          >
                            {saveState.saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSaveState(null)}
                            className="text-xs text-cof-text-tertiary hover:text-cof-text-secondary"
                          >
                            Cancel
                          </button>
                          {saveState.saveError && (
                            <p className="text-xs text-red-500 w-full mt-1">{saveState.saveError}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openSaveForm(msg)}
                          className="text-xs text-cof-text-tertiary hover:text-node-hunch transition-colors mt-1"
                        >
                          Save to graph
                        </button>
                      )}
                    </div>
                  )}
                  {msg.content && !isStreaming && msg.sessionId && (
                    <FeedbackWidget sourceType="query" sourceId={msg.sessionId} />
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-cof-border">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={isStreaming}
            className="flex-1 text-sm px-3 py-2 bg-cof-bg-elevated border border-cof-border rounded-lg focus:outline-none focus:border-node-hunch disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-node-hunch text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isStreaming && <Spinner size="sm" label="Asking" />}
            {isStreaming ? 'Thinking…' : 'Ask'}
          </button>
        </form>
      </div>

      {referencedNodes.length > 0 && panelOpen && (
        <div className="w-56 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-cof-text-tertiary uppercase tracking-wide">
              Referenced nodes
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-xs text-cof-text-tertiary hover:text-cof-text-secondary"
            >
              ›
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(nodesByType).map(([type, nodes]) => (
              <div key={type}>
                <p className="text-[10px] uppercase tracking-wide text-cof-text-tertiary mb-1">{type}</p>
                <div className="space-y-1">
                  {nodes.map(n => <NodeCard key={n.id} node={n} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {referencedNodes.length > 0 && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Show referenced nodes"
          className="w-8 flex-shrink-0 flex items-center justify-center text-cof-text-tertiary hover:text-cof-text-secondary border-l border-cof-border"
        >
          ‹
        </button>
      )}
    </div>
  );
}
