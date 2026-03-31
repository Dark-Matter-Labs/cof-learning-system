import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';
import { NodeTypeBadge } from '@/components/shared/NodeTypeBadge';
import { getNodeConnections } from '@/lib/graph/queries';

interface NodeDetailPanelProps {
  readonly node: Node;
  readonly edges: readonly Edge[];
  readonly allNodes: readonly Node[];
  readonly onClose: () => void;
}

export function NodeDetailPanel({ node, edges, allNodes, onClose }: NodeDetailPanelProps) {
  const connections = getNodeConnections(node.id, edges);
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  const extraction = node.llm_extraction;

  return (
    <div className="absolute right-0 top-[49px] bottom-0 w-72 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <NodeTypeBadge nodeType={node.node_type} />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 text-lg">×</button>
      </div>

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
      {connections.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
          <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase mb-2">Connections ({connections.length})</div>
          {connections.map(edge => {
            const isSource = edge.source_id === node.id;
            const otherNodeId = isSource ? edge.target_id : edge.source_id;
            const otherNode = nodeMap.get(otherNodeId);
            return (
              <div key={edge.id} className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                <span className="text-gray-400 dark:text-gray-600">{isSource ? '→' : '←'}</span>{' '}
                <span className="text-gray-500">{edge.edge_type}</span>{' '}
                {otherNode?.title ?? 'Unknown'}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-800 pt-3 mt-3">
        <div className="text-[10px] text-gray-500 dark:text-gray-600 uppercase">Created</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          {new Date(node.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
