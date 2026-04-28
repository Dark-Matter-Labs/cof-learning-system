'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NodeType } from '@/lib/types/nodes';
import type { EdgeType } from '@/lib/types/edges';
import { UsageTab } from './UsageTab';
import { AutoSignalsTab } from './AutoSignalsTab';

export default function SettingsPage() {
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [edgeTypes, setEdgeTypes] = useState<EdgeType[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const fetchTypes = async () => {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('node_types').select('*').order('sort_order'),
        supabase.from('edge_types').select('*').order('id'),
      ]);
      if (nodesRes.data) setNodeTypes(nodesRes.data as unknown as NodeType[]);
      if (edgesRes.data) setEdgeTypes(edgesRes.data as unknown as EdgeType[]);
    };

    fetchTypes();
  }, []);

  return (
    <div className="page-with-nav"><div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-cof-text-primary mb-6">Settings</h1>

      {/* Node Types */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-cof-text-tertiary uppercase tracking-widest mb-3">Node Types</h2>
        <div className="space-y-1.5">
          {nodeTypes.map(type => (
            <div key={type.id} className="flex items-center gap-3 bg-cof-bg-elevated border border-cof-border rounded-lg p-3">
              <div
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: type.color ?? '#888' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-cof-text-primary">{type.label}</div>
                <div className="text-xs text-cof-text-secondary">{type.description}</div>
              </div>
              <span className="text-xs text-cof-text-tertiary font-mono">{type.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge Types */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-cof-text-tertiary uppercase tracking-widest mb-3">Edge Types</h2>
        <div className="space-y-1.5">
          {edgeTypes.map(type => (
            <div key={type.id} className="flex items-center gap-3 bg-cof-bg-elevated border border-cof-border rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-cof-text-primary">{type.label}</div>
              </div>
              <span className="text-xs text-cof-text-tertiary">
                {type.is_directional ? 'directional' : 'bidirectional'}
              </span>
              <span className="text-xs text-cof-text-tertiary font-mono">{type.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Config (read-only for v1) */}
      <div>
        <h2 className="text-xs font-semibold text-cof-text-tertiary uppercase tracking-widest mb-3">Agent Configuration</h2>
        <div className="bg-cof-bg-elevated border border-cof-border rounded-lg p-4">
          <p className="text-xs text-cof-text-secondary mb-3">LLM agent settings are configured via environment variables. Contact your admin to change these.</p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-cof-text-secondary">Extraction model:</span>
              <span className="text-cof-text-primary">{process.env.NEXT_PUBLIC_EXTRACTION_MODEL ?? 'claude-sonnet-4'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* LLM Usage */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold text-cof-text-tertiary uppercase tracking-widest mb-3">LLM Usage</h2>
        <UsageTab />
      </div>

      {/* Auto-signals */}
      <section className="mt-8">
        <h2 className="text-base font-semibold text-cof-text-primary mb-4">Auto-signals</h2>
        <AutoSignalsTab />
      </section>
    </div></div>
  );
}
