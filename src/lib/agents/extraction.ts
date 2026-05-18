import type { LlmExtraction, MeetingExtraction, DocumentExtraction } from '@/lib/types/nodes';
import { callLLM } from '@/lib/llm';
import {
  ORG_CONTEXT,
  DOMAIN_TAGS,
  getLlmNodeTypeEnum,
  getLlmNodeTypeDescriptions,
} from '@/lib/config/captureTypes';
import { extractJsonObject } from '@/lib/utils/json';

// Computed once at module load from taxonomy config — change captureTypes.ts to update these.
const LLM_NODE_TYPE_ENUM = getLlmNodeTypeEnum();
const LLM_NODE_TYPE_DESCRIPTIONS = getLlmNodeTypeDescriptions();
const LLM_DOMAIN_TAGS_JSON = DOMAIN_TAGS.map(t => `"${t}"`).join(', ');
const LLM_DOMAIN_TAGS_LIST = DOMAIN_TAGS.join(', ');

const MEETING_SYSTEM_PROMPT = `You are an extraction system for ${ORG_CONTEXT}.

Given a meeting transcript or notes, extract MULTIPLE distinct nodes from the content. Return ONLY valid JSON:

{
  "meeting_title": "Concise meeting title (max 10 words)",
  "meeting_summary": "2-3 sentence summary of the meeting",
  "extracted_nodes": [
    {
      "node_type": "hunch|learning|commitment|signal|option|test",
      "title": "Concise title (max 10 words)",
      "summary": "2-3 sentence description of this specific insight/action/decision",
      "category": "insight|action|decision|person_mention|open_question",
      "confidence_level": 1-5,
      "domain_tags": ["relevant", "tags"],
      "rationale": "Why this was extracted as a separate node"
    }
  ],
  "participants_detected": ["Name1", "Name2"],
  "key_themes": ["theme1", "theme2"]
}

Rules:
1. Extract EVERY distinct insight, action item, decision, and open question as a separate node.
2. Map categories to node_types: insight->hunch, action->commitment, decision->learning, open_question->hunch, person_mention->signal.
3. Be thorough — a 30-minute meeting typically produces 5-15 nodes.
4. Each node must stand alone with enough context to be understood without the full transcript.
5. Domain tags: ${LLM_DOMAIN_TAGS_LIST}.
6. confidence_level: 1=vague mention, 2=discussed briefly, 3=discussed in detail, 4=agreed upon, 5=committed to.
7. Mark uncertain extractions appropriately. All outputs are suggestions for human review.`;

export interface GoalContext {
  readonly goalSpaces: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly triggerOutcomes: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly personNodes: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly existingNodes?: ReadonlyArray<{ readonly id: string; readonly title: string; readonly node_type: string }>;
}

export interface AttachmentContent {
  readonly type: 'text' | 'pdf';
  readonly textContent?: string;
  readonly base64?: string;
}

const SYSTEM_PROMPT = `You are an extraction system for ${ORG_CONTEXT}.

Given input text (which may be a rough note, call transcript, document excerpt, or transcribed audio), extract the following and return ONLY valid JSON with no other text:

{
  "node_type": "${LLM_NODE_TYPE_ENUM}",
  "maturity": "ready_to_promote|watch_closely|needs_development|cluster_dependent",
  "title": "Concise title (max 10 words)",
  "summary": "2-3 sentence summary of the core insight or claim",
  "structured_claim": { "if": "condition", "then": "consequence", "because": "reasoning" } or null if no clear causal claim,
  "assumption_type": "background" or "foreground" or null,
  "entities": [{ "name": "...", "type": "person|organisation|site|concept" }],
  "domain_tags": [${LLM_DOMAIN_TAGS_JSON}],
  "suggested_connections": [{ "target_title": "existing concept name", "edge_type": "supports|contradicts|requires|challenges", "rationale": "why" }],
  "confidence_assessment": { "level": 1-5, "basis": "intuition|analogy|observation|early_evidence|strong_evidence" },
  "open_questions": ["question 1", "question 2"],
  "commitment_relevance": {
    "relevant": true,
    "commitment_areas": ["area 1", "area 2"],
    "tension_flag": false,
    "tension_description": null
  },
  "goal_relevance": [{ "outcome_id": "id of trigger outcome", "outcome_title": "title", "rationale": "why this node is relevant to this outcome" }],
  "expected_signals": ["signal that would indicate progress"]
}

CRITICAL — Node type and maturity classification:
1. NODE_TYPE: Based on the content, classify as one of:
${LLM_NODE_TYPE_DESCRIPTIONS}
2. MATURITY: Classify as one of:
   - ready_to_promote: Clear, well-supported, should go directly to the graph
   - watch_closely: Plausible but needs more evidence before acting on it
   - needs_development: Early-stage, needs further work before it's useful
   - cluster_dependent: Only meaningful in relation to other entries in the same batch

Rules for commitment_relevance:
10. COMMITMENT_RELEVANCE: Does this hunch or signal relate to any existing commitments?
    Could it support, challenge, or inform reallocation of any committed resources?
    - Set relevant=true if this relates to resource allocation, delivery obligations, or active commitments
    - List commitment_areas as the domains/areas of work this might affect (e.g. "carbon", "philanthropy", "COF formation")
    - Set tension_flag=true ONLY if this DIRECTLY contradicts a known assumption a commitment depends on
    - If tension_flag is true, write a clear tension_description explaining the contradiction
    - If this is a signal that contradicts a known assumption, flag TENSION_FLAG: true prominently

Rules for goal_relevance and expected_signals (only present when goal context is provided):
11. GOAL_RELEVANCE: Which trigger outcomes does this node relate to? Only include outcomes from the provided list. Include outcome_id (exact ID from list), outcome_title, and a concise rationale. Omit if no clear relevance. This field is optional.
12. EXPECTED_SIGNALS: What observable signals would indicate this hunch/intervention is working or this signal is meaningful? List 1-3 concrete, measurable signals. This field is optional.
13. PERSON_DETECTION: If the text mentions any person from the known persons list below, add a suggested_connection with edge_type "mentioned_in", target_title set to the exact person name from the list, and a rationale explaining the mention. Only suggest connections for persons that are clearly referenced in the text. Do NOT fabricate person mentions.

Mark uncertain extractions appropriately. All outputs are suggestions for human review.`;


export function buildExtractionPrompt(
  title: string,
  description: string,
  goalContext?: GoalContext,
  textFileContent?: string,
): string {
  let base: string;
  if (textFileContent) {
    const docBlock = `<document>\n${textFileContent}\n</document>`;
    base = title
      ? `Title hint: ${title}\n\nGenerate a concise title for this document based on its content.\n\n${docBlock}`
      : `Generate a concise title for this document based on its content.\n\n${docBlock}`;
  } else {
    const truncated = description.length > 4000
      ? description.slice(0, 4000) + '\n\n[truncated for extraction]'
      : description;
    base = `Title: ${title}\n\nDescription: ${truncated}`;
  }

  if (!goalContext) {
    return base;
  }

  const hasGoalSpaces = goalContext.goalSpaces.length > 0;
  const hasTriggerOutcomes = goalContext.triggerOutcomes.length > 0;
  const hasPersonNodes = goalContext.personNodes.length > 0;
  const hasExistingNodes = (goalContext.existingNodes?.length ?? 0) > 0;

  if (!hasGoalSpaces && !hasTriggerOutcomes && !hasPersonNodes && !hasExistingNodes) {
    return base;
  }

  const sections: string[] = [base, ''];

  if (hasGoalSpaces) {
    sections.push('Active goal spaces:');
    for (const gs of goalContext.goalSpaces) {
      sections.push(`- ${gs.title} (id: ${gs.id})`);
    }
  }

  if (hasTriggerOutcomes) {
    if (hasGoalSpaces) sections.push('');
    sections.push('Active trigger outcomes:');
    for (const to of goalContext.triggerOutcomes) {
      sections.push(`- ${to.title} (id: ${to.id})`);
    }
  }

  if (hasTriggerOutcomes || hasGoalSpaces) {
    sections.push('');
    sections.push('If this node relates to any of the trigger outcomes above, include goal_relevance in your response using the exact outcome IDs provided.');
  }

  if (hasPersonNodes) {
    sections.push('');
    sections.push('Known persons in the system:');
    for (const p of goalContext.personNodes) {
      sections.push(`- ${p.title} (id: ${p.id})`);
    }
    sections.push('');
    sections.push('If this text mentions any of the persons above, include a suggested_connection with edge_type "mentioned_in" and target_title matching the exact name from this list.');
  }

  if (hasExistingNodes) {
    sections.push('');
    sections.push('Existing nodes in the graph (use these exact titles in suggested_connections where relevant):');
    for (const n of goalContext.existingNodes!.slice(0, 20)) {
      sections.push(`- [${n.node_type}] ${n.title}`);
    }
    sections.push('');
    sections.push('When this note connects to any node listed above, add it to suggested_connections using the EXACT title shown.');
  }

  return sections.join('\n');
}

export function parseExtractionResponse(content: string): LlmExtraction {
  const stripped = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const cleaned = extractJsonObject(stripped);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // LLM returned natural language instead of JSON — likely a PDF it cannot read
    throw new Error('PDF_UNREADABLE');
  }

  // Validate required fields
  const required = ['title', 'summary', 'entities', 'domain_tags', 'suggested_connections', 'confidence_assessment', 'open_questions'];
  for (const field of required) {
    if (!(field in (parsed as Record<string, unknown>))) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as LlmExtraction;
}

export async function runExtraction(
  title: string,
  description: string,
  goalContext?: GoalContext,
  attachmentContent?: AttachmentContent,
): Promise<LlmExtraction> {
  let promptText: string;
  if (attachmentContent?.type === 'text' && attachmentContent.textContent) {
    promptText = buildExtractionPrompt(title, '', goalContext, attachmentContent.textContent);
  } else if (attachmentContent?.type === 'pdf') {
    const cleanTitle = title.replace(/\.pdf$/i, '').replace(/_/g, ' ');
    const pdfNote = 'A PDF document is attached — read it and extract insights from its full content.';
    const effectiveDescription = description.trim()
      ? `${pdfNote}\n\nAdditional context from submitter: ${description}`
      : pdfNote;
    promptText = buildExtractionPrompt(cleanTitle, effectiveDescription, goalContext);
  } else {
    promptText = buildExtractionPrompt(title, description, goalContext);
  }

  const response = await callLLM('extraction', {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: promptText,
    maxTokens: 2048,
    temperature: 0.3,
    pdfBase64: attachmentContent?.type === 'pdf' ? attachmentContent.base64 : undefined,
  });

  return parseExtractionResponse(response.content);
}

export function buildMeetingExtractionPrompt(
  title: string,
  description: string,
  meetingDate?: string,
  participants?: readonly string[],
  goalContext?: GoalContext,
): string {
  const sections: string[] = [`Meeting: ${title}`];
  if (meetingDate) sections.push(`Date: ${meetingDate}`);
  if (participants && participants.length > 0) sections.push(`Participants: ${participants.join(', ')}`);
  const truncatedDesc = description.length > 8000
    ? description.slice(0, 8000) + '\n\n[truncated for extraction]'
    : description;
  sections.push('', 'Transcript/Notes:', truncatedDesc);

  if (goalContext) {
    const { goalSpaces, triggerOutcomes } = goalContext;
    if (goalSpaces.length > 0) {
      sections.push('', 'Active goal spaces:');
      for (const gs of goalSpaces) sections.push(`- ${gs.title} (id: ${gs.id})`);
    }
    if (triggerOutcomes.length > 0) {
      sections.push('', 'Active trigger outcomes:');
      for (const to of triggerOutcomes) sections.push(`- ${to.title} (id: ${to.id})`);
    }
  }
  return sections.join('\n');
}

export function parseMeetingExtractionResponse(content: string): MeetingExtraction {
  const stripped = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const cleaned = extractJsonObject(stripped);
  const parsed = JSON.parse(cleaned);
  const required = ['meeting_title', 'meeting_summary', 'extracted_nodes'];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  if (!Array.isArray(parsed.extracted_nodes) || parsed.extracted_nodes.length === 0) {
    throw new Error('extracted_nodes must be a non-empty array');
  }
  return parsed as MeetingExtraction;
}

const DOCUMENT_SYSTEM_PROMPT = `You are an extraction system for ${ORG_CONTEXT}.

Given a document, long note, or rich text capture, extract MULTIPLE distinct nodes. Return ONLY valid JSON:

{
  "document_title": "Concise document title (max 10 words)",
  "document_summary": "2-3 sentence summary of the content",
  "extracted_nodes": [
    {
      "node_type": "${LLM_NODE_TYPE_ENUM}",
      "title": "Concise title (max 10 words)",
      "summary": "2-3 sentence description of this specific insight, claim, or idea",
      "confidence_level": 1-5,
      "domain_tags": ["relevant", "tags"],
      "suggested_connections": [
        { "target_title": "exact title of a related node", "edge_type": "supports|contradicts|requires|evolved_from|challenges|tested_by", "rationale": "why connected" }
      ]
    }
  ]
}

Node type rules:
${LLM_NODE_TYPE_DESCRIPTIONS}

Domain tags: ${LLM_DOMAIN_TAGS_LIST}

confidence_level: 1=vague mention, 2=discussed briefly, 3=discussed in detail, 4=agreed upon, 5=committed to

Rules:
1. Extract distinct insights, claims, arguments, and questions as separate nodes. Maximum 20 nodes total.
2. A dense 500-word note typically produces 3-8 nodes. A long document 8-15.
3. Prioritise the most important and distinct nodes. Merge closely related points.
4. Each node must stand alone with enough context to be understood without the full document.
5. Mark uncertain extractions appropriately. All outputs are suggestions for human review.
6. In suggested_connections, you may reference: (a) other nodes you extracted from this document — use the exact title you gave them, and (b) any existing graph nodes listed in the prompt. Omit the field if no strong connections exist.`;

export function buildDocumentExtractionPrompt(
  title: string,
  description: string,
  textFileContent?: string,
  existingNodes?: ReadonlyArray<{ readonly id: string; readonly title: string; readonly node_type: string }>,
): string {
  const cleanTitle = title.replace(/\.(pdf|txt|docx?)$/i, '').replace(/_/g, ' ');
  let base: string;
  if (textFileContent) {
    const titleHint = cleanTitle ? `Title hint: ${cleanTitle}\n\n` : '';
    base = `${titleHint}Extract all insights from this document:\n\n<document>\n${textFileContent}\n</document>`;
  } else {
    const truncated = description.length > 8000
      ? description.slice(0, 8000) + '\n\n[truncated]'
      : description;
    base = cleanTitle
      ? `Title hint: ${cleanTitle}\n\nContent:\n${truncated}`
      : `Content:\n${truncated}`;
  }
  if (existingNodes && existingNodes.length > 0) {
    const nodeList = existingNodes.slice(0, 20).map(n => `- [${n.node_type}] ${n.title}`).join('\n');
    base += `\n\nExisting graph nodes (use exact titles in suggested_connections where relevant):\n${nodeList}`;
  }
  return base;
}

export function parseDocumentExtractionResponse(content: string): DocumentExtraction {
  const stripped = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const cleaned = extractJsonObject(stripped);
  const parsed = JSON.parse(cleaned);
  const required = ['document_title', 'document_summary', 'extracted_nodes'];
  for (const field of required) {
    if (!(field in parsed)) throw new Error(`Missing required field: ${field}`);
  }
  if (!Array.isArray(parsed.extracted_nodes) || parsed.extracted_nodes.length === 0) {
    throw new Error('extracted_nodes must be a non-empty array');
  }
  return parsed as DocumentExtraction;
}

export async function runDocumentExtraction(
  title: string,
  description: string,
  attachmentContent?: AttachmentContent,
  goalContext?: GoalContext,
): Promise<DocumentExtraction> {
  const existingNodes = goalContext?.existingNodes;
  let promptText: string;

  if (attachmentContent?.type === 'text' && attachmentContent.textContent) {
    promptText = buildDocumentExtractionPrompt(title, description, attachmentContent.textContent, existingNodes);
  } else if (attachmentContent?.type === 'pdf') {
    const cleanTitle = title.replace(/\.pdf$/i, '').replace(/_/g, ' ');
    const pdfInstruction = 'Read the attached PDF and extract all distinct insights from it.';
    const effectiveDesc = description.trim()
      ? `${pdfInstruction}\n\nSubmitter notes: ${description}`
      : pdfInstruction;
    promptText = buildDocumentExtractionPrompt(cleanTitle, effectiveDesc, undefined, existingNodes);
  } else {
    promptText = buildDocumentExtractionPrompt(title, description, undefined, existingNodes);
  }

  const response = await callLLM('extraction', {
    systemPrompt: DOCUMENT_SYSTEM_PROMPT,
    userMessage: promptText,
    maxTokens: 8192,
    temperature: 0.3,
    pdfBase64: attachmentContent?.type === 'pdf' ? attachmentContent.base64 : undefined,
  });

  return parseDocumentExtractionResponse(response.content);
}

export async function runMeetingExtraction(
  title: string,
  description: string,
  meetingDate?: string,
  participants?: readonly string[],
  goalContext?: GoalContext,
): Promise<MeetingExtraction> {
  const response = await callLLM('extraction', {
    systemPrompt: MEETING_SYSTEM_PROMPT,
    userMessage: buildMeetingExtractionPrompt(title, description, meetingDate, participants, goalContext),
    maxTokens: 4096,
    temperature: 0.3,
  });
  return parseMeetingExtractionResponse(response.content);
}
