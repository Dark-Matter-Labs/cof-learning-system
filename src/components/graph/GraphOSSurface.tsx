'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { GraphCanvas } from './GraphCanvas';
import { GraphTopBar, type GraphView } from './GraphTopBar';
import { DashboardSidebar } from './DashboardSidebar';
import { NodeDetailPanel } from './NodeDetailPanel';
import { GoalSpacePanel } from './GoalSpacePanel';
import { ProcessFlow } from '@/components/process/ProcessFlow';
import { getGraphTypes, GOAL_CONTAINER_TYPE } from '@/lib/config/captureTypes';

const NODE_TYPE_OPTIONS = getGraphTypes();
const ALL_TYPE_IDS = NODE_TYPE_OPTIONS.map(t => t.id);

export function GraphOSSurface() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([...ALL_TYPE_IDS]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [processFlowNode, setProcessFlowNode] = useState<Node | null>(null);
  const [currentView, setCurrentView] = useState<GraphView>('force');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      try {
        const [nodesResult, edgesResult] = await Promise.all([
          supabase.from('nodes').select('*'),
          supabase.from('edges').select('*'),
        ]);

        if (nodesResult.error) throw nodesResult.error;
        if (edgesResult.error) throw edgesResult.error;

        setNodes(nodesResult.data ?? []);
        setEdges(edgesResult.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const nodesChannel = supabase
      .channel('nodes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, payload => {
        if (payload.eventType === 'INSERT') {
          setNodes(prev => [...prev, payload.new as Node]);
        } else if (payload.eventType === 'UPDATE') {
          setNodes(prev => prev.map(n => (n.id === (payload.new as Node).id ? (payload.new as Node) : n)));
        } else if (payload.eventType === 'DELETE') {
          setNodes(prev => prev.filter(n => n.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
    };
  }, []);

  const handleToggleType = useCallback((type: string) => {
    setActiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const handleSelectNode = useCallback((node: Node | null) => {
    setSelectedNode(node);
  }, []);

  const handleProcessThis = useCallback((node: Node) => {
    setProcessFlowNode(node);
  }, []);

  const goalSpaces = nodes.filter(n => n.node_type === GOAL_CONTAINER_TYPE);
  const triggerOutcomes = nodes.filter(n => n.node_type === 'trigger_outcome');

  const sidebarStats = {
    awaitingReview: nodes.filter(n => n.status === 'llm_reviewed').length,
    promotedThisWeek: nodes.filter(n => {
      if (n.status !== 'promoted') return false;
      const updated = new Date(n.updated_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return updated >= weekAgo;
    }).length,
    activeTests: nodes.filter(n => n.node_type === 'test' && n.status !== 'archived').length,
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading graph…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-gray-50 dark:bg-gray-950">
      <GraphCanvas
        nodes={nodes.filter(n => n.attachments.length === 0 && !['raw', 'processing', 'archived', 'error'].includes(n.status))}
        edges={edges}
        activeTypes={activeTypes}
        view={currentView}
        onSelectNode={handleSelectNode}
        onChangeView={setCurrentView}
      />

      <GraphTopBar
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        nodeTypes={NODE_TYPE_OPTIONS}
      />

      <DashboardSidebar
        stats={sidebarStats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
      />

      {selectedNode !== null && selectedNode.node_type === 'goal_space' && (
        <GoalSpacePanel
          node={selectedNode}
          edges={edges}
          allNodes={nodes}
          onClose={() => setSelectedNode(null)}
        />
      )}
      {selectedNode !== null && selectedNode.node_type !== 'goal_space' && (
        <NodeDetailPanel
          node={selectedNode}
          edges={edges}
          allNodes={nodes}
          onClose={() => setSelectedNode(null)}
          onNodeUpdated={(updatedNode) => {
            setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
            setSelectedNode(updatedNode);
          }}
          onEdgeAdded={edge => setEdges(prev => [...prev, edge])}
          onEdgeRemoved={edgeId => setEdges(prev => prev.filter(e => e.id !== edgeId))}
          onProcessThis={handleProcessThis}
        />
      )}

      {processFlowNode !== null && (
        <ProcessFlow
          sourceNode={processFlowNode}
          allNodes={nodes}
          allEdges={edges}
          onClose={() => setProcessFlowNode(null)}
          onNodeCreated={(node) => {
            setNodes(prev => [...prev, node]);
          }}
          onEdgeAdded={(edge) => {
            setEdges(prev => [...prev, edge]);
          }}
          onNodeUpdated={(updatedNode) => {
            setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
            if (selectedNode?.id === updatedNode.id) {
              setSelectedNode(updatedNode);
            }
          }}
        />
      )}
    </div>
  );
}
