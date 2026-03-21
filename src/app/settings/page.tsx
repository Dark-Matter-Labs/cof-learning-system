'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NodeType } from '@/lib/types/nodes';
import type { EdgeType } from '@/lib/types/edges';

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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-gray-200 mb-6">Settings</h1>

      {/* Node Types */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Node Types</h2>
        <div className="space-y-2">
          {nodeTypes.map(type => (
            <div key={type.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: type.color ?? '#888' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">{type.label}</div>
                <div className="text-xs text-gray-500">{type.description}</div>
              </div>
              <span className="text-xs text-gray-600 font-mono">{type.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge Types */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Edge Types</h2>
        <div className="space-y-2">
          {edgeTypes.map(type => (
            <div key={type.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">{type.label}</div>
              </div>
              <span className="text-xs text-gray-600">
                {type.is_directional ? 'directional' : 'bidirectional'}
              </span>
              <span className="text-xs text-gray-600 font-mono">{type.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Config (read-only for v1) */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Agent Configuration</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-3">LLM agent settings are configured via environment variables. Contact your admin to change these.</p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Extraction model:</span>
              <span className="text-gray-300">{process.env.NEXT_PUBLIC_EXTRACTION_MODEL ?? 'claude-sonnet-4'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
