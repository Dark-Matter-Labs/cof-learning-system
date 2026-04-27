'use client';

import { useState } from 'react';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import type { LifecycleStage } from '@/lib/lifecycle/autoPromote';
import { NodeTypeBadge } from '@/components/shared/NodeTypeBadge';
import { NodeSearchAutocomplete, type NodeOption } from '@/components/shared/NodeSearchAutocomplete';
import { getNodeConnections } from '@/lib/graph/queries';

const NODE_TYPE_OPTIONS = [
  { id: 'hunch',                   label: 'Hunch' },
  { id: 'assumption_background',   label: 'Background Assumption' },
  { id: 'assumption_foreground',   label: 'Foreground Assumption' },
  { id: 'test',                    label: 'Test' },
  { id: 'learning',                label: 'Learning' },
  { id: 'option',                  label: 'Option' },
  { id: 'entity',                  label: 'Entity' },
  { id: 'site',                    label: 'Site' },
  { id: 'commitment',              label: 'Commitment' },
  { id: 'intervention',            label: 'Intervention' },
  { id: 'signal',                  label: 'Signal' },
  { id: 'goal_space',              label: 'Goal space' },
  { id: 'trigger_outcome',         label: 'Trigger outcome' },
] as const;

const EDGE_TYPES = [
  { id: 'supports',              label: 'Supports',              directional: true },
  { id: 'contradicts',           label: 'Contradicts',           directional: true },
  { id: 'requires',              label: 'Requires',              directional: true },
  { id: 'evolved_from',          label: 'Evolved from',          directional: true },
  { id: 'tested_by',             label: 'Tested by',             directional: true },
  { id: 'produced',              label: 'Produced',              directional: true },
  { id: 'connected_to',          label: 'Connected to',          directional: false },
  { id: 'works_at',              label: 'Works at',              directional: true },
  { id: 'authored_by',           label: 'Authored by',           directional: true },
  { id: 'challenges',            label: 'Challenges',            directional: true },
  { id: 'advances_goal',         label: 'Advances goal',         directional: true },
  { id: 'targets_outcome',       label: 'Targets outcome',       directional: true },
  { id: 'indicates_progress',    label: 'Indicates progress',    directional: true },
  { id: 'assigned_to_outcome',   label: 'Assigned to outcome',   directional: true },
  { id: 'participated_in',       label: 'Participated in',       directional: true },
  { id: 'mentioned_in',          label: 'Mentioned in',          directional: true },
] as const;

const USER_FACING_STATUSES = ['promoted', 'archived', 'falsified', 'suspended'] as const;
type UserFacingStatus = typeof USER_FACING_STATUSES[number];

interface NodeDetailPanelProps {
  readonly node: Node;
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
  readonly onNodeUpdated?: (node: Node) => void;
  readonly onEdgeAdded?: (edge: Edge) => void;
  readonly onEdgeRemoved?: (edgeId: string) => void;
  readonly onProcessThis?: (node: Node) => void;
}

const PROCESSABLE_TYPES = new Set(['learning', 'signal']);

interface LifecyclePromptProps {
  readonly stage: LifecycleStage;
  readonly nodeId: string;
  readonly daysSinceTransition: number;
}

function LifecyclePrompt({ stage, nodeId, daysSinceTransition }: LifecyclePromptProps) {
  const prompts: Partial<Record<LifecycleStage, { threshold: number; text: string; actions: readonly { label: string; href: string }[] }>> = {
    divergence: {
      threshold: 7,
      text: `This hunch has been sitting for ${daysSinceTransition} days.`,
      actions: [
        { label: 'Connect an assumption', href: `/capture/${nodeId}` },
        { label: 'Archive it', href: `/capture/${nodeId}` },
      ],
    },
    attractor: {
      threshold: 14,
      text: 'This has assumptions but no reinforced evidence yet.',
      actions: [{ label: 'Design a test', href: `/capture/${nodeId}` }],
    },
    convergence: {
      threshold: 14,
      text: 'Resources committed but no recent signals.',
      actions: [
        { label: 'Log a signal', href: `/capture` },
        { label: 'Update commitment', href: `/commitments` },
      ],
    },
    execution: {
      threshold: 0,
      text: 'This is now executing.',
      actions: [{ label: 'Capture an outcome', href: `/capture` }],
    },
  };

  const prompt = prompts[stage];
  if (!prompt || daysSinceTransition < prompt.threshold) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{prompt.text}</p>
      <div className="flex flex-wrap gap-2">
        {prompt.actions.map(action => (
          <a
            key={action.label}
            href={action.href}
            className="text-xs text-node-hunch border border-node-hunch/30 rounded px-2 py-1 hover:bg-node-hunch/5 transition-colors"
          >
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function NodeDetailPanel({
  node,
  edges,
  allNodes,
  onClose,
  onNodeUpdated,
  onEdgeAdded,
  onEdgeRemoved,
  onProcessThis,
}: NodeDetailPanelProps) {
  const connections = getNodeConnections(node.id, edges);
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  const extraction = node.llm_extraction;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit field states — initialized from node prop, never mutate node
  const [editTitle, setEditTitle] = useState(node.title);
  const [editDescription, setEditDescription] = useState(node.description ?? '');
  const [editNodeType, setEditNodeType] = useState(node.node_type);
  const [editConfidenceLevel, setEditConfidenceLevel] = useState<number | null>(node.confidence_level);
  const [editStatus, setEditStatus] = useState<UserFacingStatus>(
    USER_FACING_STATUSES.includes(node.status as UserFacingStatus)
      ? (node.status as UserFacingStatus)
      : 'promoted'
  );
  const [editDomainTags, setEditDomainTags] = useState<string[]>([...node.domain_tags]);
  const [tagInput, setTagInput] = useState('');

  // Connection management state
  const [removingEdgeId, setRemovingEdgeId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSelectedNode, setAddSelectedNode] = useState<NodeOption | null>(null);
  const [addEdgeType, setAddEdgeType] = useState<string>(EDGE_TYPES[0].id);
  const [addIsSourceFirst, setAddIsSourceFirst] = useState(true); // true = current node is source
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedEdgeTypeDef = EDGE_TYPES.find(et => et.id === addEdgeType) ?? EDGE_TYPES[0];
  const isDirectional = selectedEdgeTypeDef.directional;

  function handleStartEdit() {
    setEditTitle(node.title);
    setEditDescription(node.description ?? '');
    setEditNodeType(node.node_type);
    setEditConfidenceLevel(node.confidence_level);
    setEditStatus(
      USER_FACING_STATUSES.includes(node.status as UserFacingStatus)
        ? (node.status as UserFacingStatus)
        : 'promoted'
    );
    setEditDomainTags([...node.domain_tags]);
    setTagInput('');
    setSaveError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setSaveError(null);
    setTagInput('');
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/nodes/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription.trim() === '' ? null : editDescription,
          node_type: editNodeType,
          confidence_level: editConfidenceLevel,
          status: editStatus,
          domain_tags: editDomainTags,
        }),
      });

      const result = await response.json() as { data?: Node; error?: string };

      if (!response.ok || result.error) {
        setSaveError(result.error ?? 'Failed to save changes');
        return;
      }

      if (result.data) {
        onNodeUpdated?.(result.data);
      }
      setIsEditing(false);
    } catch {
      setSaveError('Network error — could not save changes');
    } finally {
      setIsSaving(false);
    }
  }

  function handleRemoveTag(tag: string) {
    setEditDomainTags(prev => prev.filter(t => t !== tag));
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,$/, '');
      if (newTag.length > 0 && !editDomainTags.includes(newTag)) {
        setEditDomainTags(prev => [...prev, newTag]);
      }
      setTagInput('');
    }
  }

  async function handleRemoveEdge(edgeId: string) {
    setRemovingEdgeId(edgeId);
    setRemoveError(null);

    try {
      const response = await fetch(`/api/edges/${edgeId}`, { method: 'DELETE' });

      if (!response.ok) {
        setRemoveError('Failed to remove connection');
        return;
      }

      onEdgeRemoved?.(edgeId);
    } catch {
      setRemoveError('Network error — could not remove connection');
    } finally {
      setRemovingEdgeId(null);
    }
  }

  function handleOpenAddForm() {
    setShowAddForm(true);
    setAddSelectedNode(null);
    setAddEdgeType(EDGE_TYPES[0].id);
    setAddIsSourceFirst(true);
    setAddError(null);
  }

  function handleCancelAddForm() {
    setShowAddForm(false);
    setAddSelectedNode(null);
    setAddEdgeType(EDGE_TYPES[0].id);
    setAddIsSourceFirst(true);
    setAddError(null);
  }

  async function handleConfirmAddEdge() {
    if (!addSelectedNode) {
      setAddError('Please select a node to connect to');
      return;
    }

    setIsAddingEdge(true);
    setAddError(null);

    const sourceId = addIsSourceFirst ? node.id : addSelectedNode.id;
    const targetId = addIsSourceFirst ? addSelectedNode.id : node.id;

    try {
      const response = await fetch('/api/graph/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceId,
          target_id: targetId,
          edge_type: addEdgeType,
        }),
      });

      const result = await response.json() as { data?: Edge; error?: string };

      if (!response.ok || result.error) {
        const isDuplicate = result.error?.includes('duplicate') || result.error?.includes('unique');
        setAddError(isDuplicate ? 'This connection already exists' : (result.error ?? 'Failed to create connection'));
        return;
      }

      if (result.data) {
        onEdgeAdded?.(result.data);
      }

      setShowAddForm(false);
      setAddSelectedNode(null);
      setAddEdgeType(EDGE_TYPES[0].id);
      setAddIsSourceFirst(true);
      setAddError(null);
    } catch {
      setAddError('Network error — could not create connection');
    } finally {
      setIsAddingEdge(false);
    }
  }

  const panelWidth = isEditing ? 'w-96' : 'w-72';

  return (
    <div className={`absolute right-0 top-[49px] bottom-0 ${panelWidth} bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 p-4 overflow-y-auto transition-all duration-150 z-30`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <NodeTypeBadge nodeType={isEditing ? editNodeType : node.node_type} />
        <div className="flex items-center gap-2">
          {!isEditing && PROCESSABLE_TYPES.has(node.node_type) && onProcessThis && (
            <button
              onClick={() => onProcessThis(node)}
              aria-label="Process this node"
              className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 px-1.5 py-0.5 rounded border border-teal-300 dark:border-teal-700 hover:border-teal-500"
            >
              Process this
            </button>
          )}
          {!isEditing && (
            <button
              onClick={handleStartEdit}
              aria-label="Edit node"
              className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-500 dark:hover:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:border-gray-400"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close node detail panel"
            className="text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 text-lg"
          >
            ×
          </button>
        </div>
      </div>

      {/* View mode */}
      {!isEditing && (
        <>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200 mb-2">{node.title}</h3>

          {/* Summary from extraction */}
          {extraction?.summary && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{extraction.summary}</p>
          )}

          {/* Structured claim */}
          {extraction?.structured_claim && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-2.5 mb-3 border border-gray-200 dark:border-gray-800">
              <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">Structured Claim</div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                <span className="text-gray-500">If</span> {extraction.structured_claim.if},{' '}
                <span className="text-gray-500">then</span> {extraction.structured_claim.then},{' '}
                <span className="text-gray-500">because</span> {extraction.structured_claim.because}
              </p>
            </div>
          )}

          {/* Open questions */}
          {extraction?.open_questions && extraction.open_questions.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">Open Questions</div>
              <ul className="space-y-1">
                {extraction.open_questions.map((q, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-500 leading-relaxed">• {q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities */}
          {extraction?.entities && extraction.entities.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">Entities</div>
              <div className="flex flex-wrap gap-1">
                {extraction.entities.map((entity, i) => (
                  <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    {entity.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Domain tags */}
          {node.domain_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {node.domain_tags.map(tag => (
                <span key={tag} className="bg-node-site/20 text-node-site text-[10px] px-1.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Connections */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
            <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-2">
              Connections ({connections.length})
            </div>

            {removeError && (
              <p className="text-xs text-red-500 mb-2">{removeError}</p>
            )}

            {connections.map(edge => {
              const isSource = edge.source_id === node.id;
              const otherNodeId = isSource ? edge.target_id : edge.source_id;
              const otherNode = nodeMap.get(otherNodeId);
              return (
                <div key={edge.id} className="flex items-center justify-between mb-1.5 group">
                  <div className="text-xs text-gray-600 dark:text-gray-400 min-w-0 flex-1">
                    <span className="text-gray-400 dark:text-gray-600">{isSource ? '→' : '←'}</span>{' '}
                    <span className="text-gray-500">{edge.edge_type}</span>{' '}
                    <span className="truncate">{otherNode?.title ?? 'Unknown'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveEdge(edge.id)}
                    disabled={removingEdgeId === edge.id}
                    aria-label={`Remove connection ${edge.edge_type}`}
                    className="ml-2 text-[10px] text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              );
            })}

            {/* Add connection form */}
            {!showAddForm && (
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Add connection
              </button>
            )}

            {showAddForm && (
              <div className="mt-3 space-y-2 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">New connection</div>

                {/* Node search */}
                <NodeSearchAutocomplete
                  selectedNode={addSelectedNode}
                  onChange={setAddSelectedNode}
                  excludeNodeId={node.id}
                  placeholder="Search nodes..."
                />

                {/* Edge type select */}
                <div>
                  <label htmlFor="add-edge-type" className="block text-[10px] text-gray-500 dark:text-gray-600 mb-0.5">
                    Edge type
                  </label>
                  <select
                    id="add-edge-type"
                    aria-label="Edge type"
                    value={addEdgeType}
                    onChange={e => {
                      setAddEdgeType(e.target.value);
                      setAddIsSourceFirst(true); // reset direction on type change
                    }}
                    className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {EDGE_TYPES.map(et => (
                      <option key={et.id} value={et.id}>{et.label}</option>
                    ))}
                  </select>
                </div>

                {/* Direction toggle — only for directional edge types */}
                {isDirectional && (
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-600 mb-0.5">Direction</div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAddIsSourceFirst(true)}
                        aria-label="This node → target"
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded border transition-colors ${
                          addIsSourceFirst
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        This node → Target
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddIsSourceFirst(false)}
                        aria-label="Target → this node"
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded border transition-colors ${
                          !addIsSourceFirst
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        Target → This node
                      </button>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {addError && (
                  <p className="text-xs text-red-500">{addError}</p>
                )}

                {/* Form actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleConfirmAddEdge()}
                    disabled={isAddingEdge}
                    aria-label="Confirm add connection"
                    className="flex-1 py-1 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAddingEdge ? 'Adding…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddForm}
                    disabled={isAddingEdge}
                    aria-label="Cancel add connection"
                    className="flex-1 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-3 mt-3">
            <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase">Created</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {new Date(node.created_at).toLocaleDateString()}
            </div>
          </div>

          {node.node_type === 'hunch' && node.lifecycle_stage && (
            <LifecyclePrompt
              stage={node.lifecycle_stage as LifecycleStage}
              nodeId={node.id}
              daysSinceTransition={
                node.stage_transitioned_at
                  ? Math.floor((Date.now() - new Date(node.stage_transitioned_at).getTime()) / (24 * 60 * 60 * 1000))
                  : Math.floor((Date.now() - new Date(node.created_at).getTime()) / (24 * 60 * 60 * 1000))
              }
            />
          )}
        </>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="edit-title" className="block text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="block text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">
              Description
            </label>
            <textarea
              id="edit-description"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={4}
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label htmlFor="edit-type" className="block text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">
              Type
            </label>
            <select
              id="edit-type"
              aria-label="Type"
              value={editNodeType}
              onChange={e => setEditNodeType(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {NODE_TYPE_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Confidence level */}
          <div>
            <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">Confidence</div>
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setEditConfidenceLevel(prev => prev === level ? null : level)}
                  className={`flex-1 py-1 text-xs rounded border transition-colors ${
                    editConfidenceLevel === level
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="edit-status" className="block text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">
              Status
            </label>
            <select
              id="edit-status"
              aria-label="Status"
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as UserFacingStatus)}
              className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {USER_FACING_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Domain tags */}
          <div>
            <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-1">Domain Tags</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {editDomainTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-node-site/20 text-node-site text-[10px] px-1.5 py-0.5 rounded-full">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-node-site hover:text-red-500 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Add tag (Enter or comma)"
              className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Error message */}
          {saveError && (
            <p className="text-xs text-red-500">{saveError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              aria-label="Save changes"
              className="flex-1 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              aria-label="Cancel edit"
              className="flex-1 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
