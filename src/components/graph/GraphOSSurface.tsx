'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { TensionAlert, TensionResolutionAction } from '@/lib/types/tension';
import type { HighlightState } from '@/lib/types/highlight';
import { GraphCanvas } from './GraphCanvas';
import { GraphTopBar, type GraphView } from './GraphTopBar';
import { DashboardSidebar } from './DashboardSidebar';
import { InlineCaptureCard } from './InlineCaptureCard';
import { NodeDetailPanel } from './NodeDetailPanel';
import { GoalSpacePanel } from './GoalSpacePanel';
import { CommitmentPanel } from '@/components/commitment/CommitmentPanel';

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

/** Compute which node IDs are connected to a commitment (1-hop). */
function getCommitmentConnectedNodes(commitmentId: string, edges: readonly Edge[]): ReadonlySet<string> {
  const ids = new Set<string>([commitmentId]);
  for (const e of edges) {
    if (e.source_id === commitmentId) ids.add(e.target_id);
    if (e.target_id === commitmentId) ids.add(e.source_id);
  }
  return ids;
}

/** Compute the chain for a tension alert: signal → assumption → commitments */
function getTensionChain(
  alert: TensionAlert,
  edges: readonly Edge[]
): { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (alert.source_node_id) nodeIds.add(alert.source_node_id);
  if (alert.affected_assumption_id) nodeIds.add(alert.affected_assumption_id);
  for (const id of alert.affected_commitment_ids) nodeIds.add(id);

  for (const e of edges) {
    if (nodeIds.has(e.source_id) && nodeIds.has(e.target_id)) {
      edgeIds.add(e.id);
    }
  }

  return { nodeIds, edgeIds };
}

/** Get all nodes reachable from an assumption (for assumption pill click). */
function getAssumptionTree(assumptionId: string, edges: readonly Edge[]): ReadonlySet<string> {
  const ids = new Set<string>([assumptionId]);
  // 1-hop connected
  for (const e of edges) {
    if (e.source_id === assumptionId) ids.add(e.target_id);
    if (e.target_id === assumptionId) ids.add(e.source_id);
  }
  return ids;
}

export function GraphOSSurface() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [tensions, setTensions] = useState<TensionAlert[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([...ALL_TYPE_IDS]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [capturePos, setCapturePos] = useState<{ x: number; y: number } | null>(null);
  const [captureDefaultType, setCaptureDefaultType] = useState('hunch');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentView, setCurrentView] = useState<GraphView>('force');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightState>({ type: 'none' });
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      try {
        const [nodesResult, edgesResult, tensionsResult] = await Promise.all([
          supabase.from('nodes').select('*'),
          supabase.from('edges').select('*'),
          supabase.from('tension_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }),
        ]);

        if (nodesResult.error) throw nodesResult.error;
        if (edgesResult.error) throw edgesResult.error;
        // tension_alerts table may not exist yet — ignore error gracefully
        if (!tensionsResult.error) {
          setTensions((tensionsResult.data ?? []) as TensionAlert[]);
        }

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

    const tensionsChannel = supabase
      .channel('tensions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tension_alerts' }, payload => {
        if (payload.eventType === 'INSERT') {
          const alert = payload.new as TensionAlert;
          if (alert.status === 'active') {
            setTensions(prev => [alert, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const alert = payload.new as TensionAlert;
          setTensions(prev =>
            alert.status === 'active'
              ? prev.map(t => (t.id === alert.id ? alert : t))
              : prev.filter(t => t.id !== alert.id)
          );
        } else if (payload.eventType === 'DELETE') {
          setTensions(prev => prev.filter(t => t.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(tensionsChannel);
    };
  }, []);

  const handleCanvasClick = useCallback(
    (screenX: number, screenY: number, _canvasX: number, _canvasY: number) => {
      setSelectedNode(null);
      setHighlight({ type: 'none' });
      setSelectedCommitmentId(null);
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

  // Commitment panel interactions
  const handleSelectCommitment = useCallback((id: string) => {
    setSelectedCommitmentId(id);
    const connected = getCommitmentConnectedNodes(id, edges);
    setHighlight({ type: 'commitment', commitmentId: id, connectedNodeIds: connected });
    setSelectedNode(null);
    setCapturePos(null);
  }, [edges]);

  const handleSelectTension = useCallback((alert: TensionAlert) => {
    const { nodeIds, edgeIds } = getTensionChain(alert, edges);
    setHighlight({ type: 'tension', alertId: alert.id, chainNodeIds: nodeIds, chainEdgeIds: edgeIds });
    setSelectedNode(null);
    setCapturePos(null);
  }, [edges]);

  const handleAssumptionClick = useCallback((assumptionId: string) => {
    const tree = getAssumptionTree(assumptionId, edges);
    setHighlight({ type: 'assumption', assumptionId, treeNodeIds: tree });
    setSelectedNode(null);
    setCapturePos(null);
  }, [edges]);

  const handleAcknowledgeTension = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from('tension_alerts').update({ status: 'acknowledged' }).eq('id', id);
    setTensions(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleResolveTension = useCallback(async (
    id: string,
    _action: TensionResolutionAction,
    resolvedAction: string
  ) => {
    const supabase = createClient();
    await supabase
      .from('tension_alerts')
      .update({ status: 'resolved', resolved_action: resolvedAction, resolved_at: new Date().toISOString() })
      .eq('id', id);
    setTensions(prev => prev.filter(t => t.id !== id));
  }, []);

  const commitments = nodes.filter(n => n.node_type === 'commitment');
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
        highlight={highlight}
      />

      <GraphTopBar
        activeTypes={activeTypes}
        onToggleType={handleToggleType}
        nodeTypes={NODE_TYPE_OPTIONS}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      <DashboardSidebar
        stats={sidebarStats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
      />

      <CommitmentPanel
        goalSpaces={goalSpaces}
        triggerOutcomes={triggerOutcomes}
        commitments={commitments}
        allNodes={nodes}
        edges={edges}
        tensions={tensions}
        selectedCommitmentId={selectedCommitmentId}
        onSelectCommitment={handleSelectCommitment}
        onSelectTension={handleSelectTension}
        onAssumptionClick={handleAssumptionClick}
        onAddCommitment={() => {
          setCaptureDefaultType('commitment');
          setCapturePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }}
        onAcknowledgeTension={handleAcknowledgeTension}
        onResolveTension={handleResolveTension}
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
        />
      )}
    </div>
  );
}
