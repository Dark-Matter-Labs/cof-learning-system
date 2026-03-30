import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalRelevanceField } from '../GoalRelevanceField';
import { ReviewCard } from '../ReviewCard';

const suggestions = [
  { outcome_id: 'out-1', outcome_title: 'Reduce AI risk', rationale: 'This hunch directly addresses AI safety concerns' },
  { outcome_id: 'out-2', outcome_title: 'Improve alignment', rationale: 'Secondary relevance to alignment goals' },
];

const triggerOutcomes = [
  { id: 'out-1', title: 'Reduce AI risk' },
  { id: 'out-2', title: 'Improve alignment' },
  { id: 'out-3', title: 'Accelerate biosecurity' },
];

describe('GoalRelevanceField', () => {
  it('Test 1: renders each suggested outcome with outcome_title and rationale', () => {
    render(
      <GoalRelevanceField
        suggestions={suggestions}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText('Reduce AI risk')).toBeInTheDocument();
    expect(screen.getByText('This hunch directly addresses AI safety concerns')).toBeInTheDocument();
    expect(screen.getByText('Improve alignment')).toBeInTheDocument();
    expect(screen.getByText('Secondary relevance to alignment goals')).toBeInTheDocument();
  });

  it('Test 2: each suggestion has Accept and Reject buttons', () => {
    render(
      <GoalRelevanceField
        suggestions={suggestions}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={vi.fn()}
      />
    );
    const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    expect(acceptButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });

  it('Test 3: clicking Accept calls onAction with action="accepted" and the outcome_id as final value', () => {
    const onAction = vi.fn();
    render(
      <GoalRelevanceField
        suggestions={suggestions}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={onAction}
      />
    );
    const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
    fireEvent.click(acceptButtons[0]);
    expect(onAction).toHaveBeenCalledWith('out-1', 'accepted', 'out-1');
  });

  it('Test 4: clicking Reject calls onAction with action="rejected"', () => {
    const onAction = vi.fn();
    render(
      <GoalRelevanceField
        suggestions={suggestions}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={onAction}
      />
    );
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    fireEvent.click(rejectButtons[0]);
    expect(onAction).toHaveBeenCalledWith('out-1', 'rejected', 'out-1');
  });

  it('Test 5: "Link to different outcome" renders a dropdown of triggerOutcomes when clicked', () => {
    render(
      <GoalRelevanceField
        suggestions={[suggestions[0]]}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={vi.fn()}
      />
    );
    const linkButton = screen.getByRole('button', { name: /link to different/i });
    fireEvent.click(linkButton);
    // After click, a select element should appear with trigger outcomes
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Accelerate biosecurity')).toBeInTheDocument();
  });

  it('Test 6: selecting a different outcome calls onAction with action="edited" and new outcome_id', () => {
    const onAction = vi.fn();
    render(
      <GoalRelevanceField
        suggestions={[suggestions[0]]}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={onAction}
      />
    );
    const linkButton = screen.getByRole('button', { name: /link to different/i });
    fireEvent.click(linkButton);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'out-3' } });
    expect(onAction).toHaveBeenCalledWith('out-1', 'edited', 'out-3');
  });

  it('Test 7: when goal_relevance is empty, GoalRelevanceField does not render', () => {
    const { container } = render(
      <GoalRelevanceField
        suggestions={[]}
        triggerOutcomes={triggerOutcomes}
        currentActions={{}}
        onAction={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── ReviewCard integration tests ────────────────────────────────────

const baseExtraction = {
  title: 'Test Hunch',
  summary: 'A test summary',
  structured_claim: null,
  assumption_type: null,
  entities: [],
  domain_tags: [],
  suggested_connections: [],
  confidence_assessment: { level: 3 as const, basis: 'intuition' as const },
  open_questions: [],
  commitment_relevance: null,
};

const baseNode = {
  id: 'node-1',
  node_type: 'hunch',
  title: 'Test Hunch',
  description: null,
  content: null,
  hunch_type: null,
  confidence_level: 3,
  confidence_basis: null,
  status: 'llm_reviewed' as const,
  llm_extraction: baseExtraction,
  llm_review: null,
  human_review: null,
  author_id: 'user-1',
  parent_node_id: null,
  domain_tags: [],
  external_links: [],
  attachments: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ReviewCard — GoalRelevanceField integration', () => {
  it('Test 8: ReviewCard renders GoalRelevanceField when extraction.goal_relevance is present', () => {
    const nodeWithGoalRelevance = {
      ...baseNode,
      llm_extraction: {
        ...baseExtraction,
        goal_relevance: [
          { outcome_id: 'out-1', outcome_title: 'Reduce AI risk', rationale: 'Relevant to AI safety' },
        ],
      },
    };

    render(
      <ReviewCard
        node={nodeWithGoalRelevance}
        onPromote={vi.fn()}
        onSaveDraft={vi.fn()}
        onArchive={vi.fn()}
        triggerOutcomes={triggerOutcomes}
      />
    );

    expect(screen.getByText('Goal Relevance')).toBeInTheDocument();
    expect(screen.getByText('Reduce AI risk')).toBeInTheDocument();
    expect(screen.getByText('Relevant to AI safety')).toBeInTheDocument();
  });

  it('Test 9: ReviewCard renders expected_signals as ExtractionField when present', () => {
    const nodeWithSignals = {
      ...baseNode,
      llm_extraction: {
        ...baseExtraction,
        expected_signals: ['funding increase', 'team growth'],
      },
    };

    render(
      <ReviewCard
        node={nodeWithSignals}
        onPromote={vi.fn()}
        onSaveDraft={vi.fn()}
        onArchive={vi.fn()}
        triggerOutcomes={[]}
      />
    );

    expect(screen.getByText('Expected Signals')).toBeInTheDocument();
    expect(screen.getByText('funding increase, team growth')).toBeInTheDocument();
  });
});
