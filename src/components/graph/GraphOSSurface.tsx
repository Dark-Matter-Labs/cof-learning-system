'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { GraphCanvas } from './GraphCanvas';
import { GraphTopBar, type GraphView } from './GraphTopBar';
import { DashboardSidebar } from './DashboardSidebar';
import { InlineCaptureCard } from './InlineCaptureCard';
import { NodeDetailPanel } from './NodeDetailPanel';
import { GoalSpacePanel } from './GoalSpacePanel';
import { ProcessFlow } from '@/components/process/ProcessFlow';

const NODE_TYPE_OPTIONS = [
  { id: 'hunch',                   label: 'Hunch',                   color: '#7F77DD' },
  { id: 'assumption_background',   label: 'Background Assumption',   color: '#1D9E75' },
  { id: 'assumption_foreground',   label: 'Foreground Assumption',   color: '#D85A30' },
  { id: 'test',                    label: 'Test',                    color: '#D4537E' },
  { id: 'learning',                label: 'Learning',                color: '#378ADD' },
  { id: 'option',                  label: 'Option',                  color: '#BA7517' },
  { id: 'entity',                  label: 'Entity',                  color: '#888780' },
  { id: 'site',                    label: 'Site',                    color: '#639922' },
  { id: 'commitment',              label: 'Commitment',              color: '#185FA5' },
  { id: 'intervention',            label: 'Intervention',            color: '#534AB7' },
  { id: 'signal',                  label: 'Signal',                  color: '#A32D2D' },
  { id: 'goal_space',              label: 'Goal space',              color: '#0F6E56' },
  { id: 'trigger_outcome',         label: 'Trigger outcome',         color: '#085041' },
] as const;

const ALL_TYPE_IDS = NODE_TYPE_OPTIONS.map(t => t.id);

export function GraphOSSurface() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([...ALL_TYPE_IDS]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [capturePos, setCapturePos] = useState<{ x: number; y: number } | null>(null);
  const [captureDefaultType, setCaptureDefaultType] = useState('hunch');
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

  const handleCanvasClick = useCallback(
    (screenX: number, screenY: number, _canvasX: number, _canvasY: number) => {
      setSelectedNode(null);
      setCaptureDefaultType('hunch');
      setCapturePos({ x: screenX, y: screenY });
    },
    []
  );

  const handleToggleType = useCallback((type: string) => {
    setActiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const handleNodeCreated = useCallback((_nodeId: string) => {
    setCapturePos(null);
  }, []);

  const handleSelectNode = useCallback((node: Node | null) => {
    setSelectedNode(node);
    setCapturePos(null);
  }, []);

  const handleProcessThis = useCallback((node: Node) => {
    setProcessFlowNode(node);
  }, []);

  const handleSelectCommitment = useCallback(
    (id: string) => router.push(`/commitments?id=${id}`),
    [router]
  );

  const goalSpaces = nodes.filter(n => n.node_type === 'goal_space');
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
    <div className="w-full h-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        activeTypes={activeTypes}
        view={currentView}
        onSelectNode={handleSelectNode}
        onCanvasClick={handleCanvasClick}
        onSelectCommitment={handleSelectCommitment}
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

      {capturePos !== null && (
        <InlineCaptureCard
          position={capturePos}
          defaultNodeType={captureDefaultType}
          onClose={() => setCapturePos(null)}
          onCreated={handleNodeCreated}
          goalSpaces={goalSpaces}
          triggerOutcomes={triggerOutcomes}
        />
      )}

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
