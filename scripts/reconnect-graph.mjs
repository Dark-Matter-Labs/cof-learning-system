/**
 * reconnect-graph.mjs
 *
 * One-off script to maximally connect existing nodes in the graph.
 *
 * Phase 1 (free): Re-run resolveConnections using suggestions already stored
 *   in llm_extraction.suggested_connections for every node. When first
 *   processed many target nodes didn't exist yet — they do now.
 *
 * Phase 2 (1 LLM call): Send all nodes that still have zero outgoing edges
 *   to the LLM and ask it to identify connection pairs. Create any valid matches.
 *
 * Usage:
 *   node scripts/reconnect-graph.mjs [--dry-run]
 *
 * Reads credentials from .env in the project root.
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Load env ────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL   = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY  = env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('🔍 DRY RUN — no writes\n');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const VALID_EDGE_TYPES = new Set([
  'supports', 'contradicts', 'requires', 'evolved_from', 'tested_by',
  'challenges', 'authored_by', 'works_at', 'serves_commitment',
  'tests_assumption', 'challenges_assumption', 'mentioned_in',
]);

const ACTIVE_STATUSES = ['promoted', 'human_reviewed', 'llm_reviewed', 'flagged_for_review'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getExistingEdgePairs() {
  const { data } = await supabase.from('edges').select('source_id, target_id');
  const set = new Set();
  for (const e of (data ?? [])) set.add(`${e.source_id}→${e.target_id}`);
  return set;
}

async function createEdge(sourceId, targetId, edgeType, authorId, existingPairs) {
  const key = `${sourceId}→${targetId}`;
  if (existingPairs.has(key)) return false;
  if (!VALID_EDGE_TYPES.has(edgeType)) return false;
  existingPairs.add(key); // optimistic — prevent duplicates within run
  if (DRY_RUN) return true;
  const { error } = await supabase.from('edges').insert({
    source_id: sourceId,
    target_id: targetId,
    edge_type: edgeType,
    weight: 1,
    author_id: authorId,
  });
  if (error) {
    console.warn(`  ⚠ edge insert failed (${sourceId} → ${targetId}): ${error.message}`);
    return false;
  }
  return true;
}

// ─── Phase 1: Replay stored suggested_connections ─────────────────────────────

async function phase1(nodes, titleIndex, existingPairs) {
  console.log(`\n── Phase 1: replaying stored suggested_connections for ${nodes.length} nodes`);
  let created = 0;

  for (const node of nodes) {
    const suggestions = node.llm_extraction?.suggested_connections ?? [];
    if (!suggestions.length) continue;

    for (const s of suggestions) {
      if (!s.target_title?.trim() || !VALID_EDGE_TYPES.has(s.edge_type)) continue;
      const target = titleIndex.get(s.target_title.trim().toLowerCase());
      if (!target || target.id === node.id) continue;
      const ok = await createEdge(node.id, target.id, s.edge_type, node.author_id, existingPairs);
      if (ok) {
        created++;
        console.log(`  + ${node.title.slice(0, 40)} --[${s.edge_type}]--> ${target.title.slice(0, 40)}`);
      }
    }
  }

  console.log(`Phase 1 done: ${created} edges ${DRY_RUN ? 'would be' : ''} created`);
  return created;
}

// ─── Phase 2: LLM connection discovery for orphan nodes ──────────────────────

async function phase2(allNodes, orphans, titleIndex, existingPairs) {
  if (!orphans.length) {
    console.log('\n── Phase 2: no orphans remaining, skipping LLM pass');
    return 0;
  }
  console.log(`\n── Phase 2: LLM connection discovery for ${orphans.length} orphan nodes`);

  // Build compact node list for the prompt
  const allNodeList = allNodes
    .map(n => `[${n.id.slice(0, 8)}] [${n.node_type}] ${n.title}`)
    .join('\n');

  const orphanList = orphans
    .map(n => `[${n.id.slice(0, 8)}] [${n.node_type}] ${n.title}\n  ${(n.description ?? '').slice(0, 120)}`)
    .join('\n\n');

  const prompt = `You are analysing a knowledge graph. Below are ORPHAN nodes (no connections yet) and ALL nodes in the graph.

ORPHAN NODES (need connections):
${orphanList}

ALL NODES (connection targets — use exact IDs from the 8-char prefix shown):
${allNodeList}

For each orphan, identify up to 3 strong connections to other nodes. Only suggest connections where the relationship is clear and meaningful — not merely thematic similarity.

Respond with JSON only:
{
  "connections": [
    {
      "source_id_prefix": "first 8 chars of orphan node ID",
      "target_id_prefix": "first 8 chars of target node ID",
      "edge_type": "supports|contradicts|requires|evolved_from|challenges|tested_by|mentioned_in",
      "rationale": "one sentence"
    }
  ]
}

If no strong connections exist for an orphan, omit it. Respond with {"connections": []} if none found.`;

  let parsed;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0]?.text ?? '{}';
    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('  LLM call or parse failed:', err.message);
    return 0;
  }

  // Build ID prefix lookup
  const prefixIndex = new Map();
  for (const n of allNodes) prefixIndex.set(n.id.slice(0, 8), n);

  let created = 0;
  for (const c of (parsed.connections ?? [])) {
    const source = prefixIndex.get(c.source_id_prefix);
    const target = prefixIndex.get(c.target_id_prefix);
    if (!source || !target || source.id === target.id) continue;
    if (!VALID_EDGE_TYPES.has(c.edge_type)) continue;
    const ok = await createEdge(source.id, target.id, c.edge_type, source.author_id, existingPairs);
    if (ok) {
      created++;
      console.log(`  + ${source.title.slice(0, 40)} --[${c.edge_type}]--> ${target.title.slice(0, 40)}`);
    }
  }

  console.log(`Phase 2 done: ${created} edges ${DRY_RUN ? 'would be' : ''} created`);
  return created;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching nodes…');
  const { data: nodes, error } = await supabase
    .from('nodes')
    .select('id, title, node_type, description, author_id, llm_extraction')
    .in('status', ACTIVE_STATUSES)
    .is('parent_node_id', null) // exclude document child nodes from source (they can still be targets)
    .order('created_at', { ascending: false });

  if (error) { console.error('Failed to fetch nodes:', error.message); process.exit(1); }

  // Also fetch child nodes so they appear as targets
  const { data: childNodes } = await supabase
    .from('nodes')
    .select('id, title, node_type, description, author_id, llm_extraction')
    .in('status', ACTIVE_STATUSES)
    .not('parent_node_id', 'is', null);

  const allNodes = [...(nodes ?? []), ...(childNodes ?? [])];
  console.log(`Loaded ${nodes?.length ?? 0} root nodes + ${childNodes?.length ?? 0} child nodes = ${allNodes.length} total`);

  // Build title → node index (case-insensitive)
  const titleIndex = new Map();
  for (const n of allNodes) titleIndex.set(n.title.trim().toLowerCase(), n);

  // Fetch existing edges to avoid duplicates
  const existingPairs = await getExistingEdgePairs();
  console.log(`Found ${existingPairs.size} existing edges`);

  // Phase 1
  const p1 = await phase1(nodes ?? [], titleIndex, existingPairs);

  // Identify orphans across ALL nodes (root + child)
  const { data: edgeSourceIds } = await supabase
    .from('edges')
    .select('source_id');
  const sourcesWithEdges = new Set((edgeSourceIds ?? []).map(e => e.source_id));
  for (const pair of existingPairs) {
    const [src] = pair.split('→');
    sourcesWithEdges.add(src);
  }

  const orphans = allNodes.filter(n => !sourcesWithEdges.has(n.id));

  // Phase 2 — process orphans in batches of 30 to keep prompt size manageable
  let p2 = 0;
  const BATCH = 15;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH);
    p2 += await phase2(allNodes, batch, titleIndex, existingPairs);
  }

  console.log(`\n✓ Total: ${p1 + p2} edges ${DRY_RUN ? 'would be' : ''} created`);
}

main().catch(err => { console.error(err); process.exit(1); });
