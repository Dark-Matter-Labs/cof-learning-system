import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Node, LlmExtraction, HumanReview } from '@/lib/types/nodes';
import { ReviewCard } from '../ReviewCard';

const minimalExtraction: LlmExtraction = {
  title: 'Test node title',
  summary: 'Test summary',
  structured_claim: null,
  assumption_type: null,
  entities: [],
  domain_tags: [],
  suggested_connections: [],
  confidence_assessment: { level: 3, basis: 'intuition' },
  open_questions: [],
  commitment_relevance: null,
};

const minimalNode = {
  id: 'test-id',
  author_id: 'author-1',
  status: 'llm_reviewed',
  node_type: 'hunch',
  llm_extraction: minimalExtraction,
  human_review: null,
} as unknown as Node;

describe('ReviewCard', () => {
  it('REVIEW-01: fields open with green border (pre-accepted) on first render', () => {
    render(
      <ReviewCard
        node={minimalNode}
        onPromote={vi.fn()}
        onSaveDraft={vi.fn()}
        onArchive={vi.fn()}
      />
    );
    // ExtractionField for Title should have border-l-green-500 (accepted state)
    const titleLabel = screen.getByText('Title');
    const titleField = titleLabel.closest('[class*="border-l"]');
    expect(titleField?.className).toMatch(/border-l-green-500/);
  });

  it('REVIEW-02: Promote to Graph button is enabled on first render without user interaction', () => {
    render(
      <ReviewCard
        node={minimalNode}
        onPromote={vi.fn()}
        onSaveDraft={vi.fn()}
        onArchive={vi.fn()}
      />
    );
    const promoteButton = screen.getByRole('button', { name: 'Promote to Graph' });
    expect(promoteButton).not.toBeDisabled();
  });

  it('REVIEW-03: Promote all button accepts all fields and calls onPromote in one click', () => {
    const onPromote = vi.fn();
    render(
      <ReviewCard
        node={minimalNode}
        onPromote={onPromote}
        onSaveDraft={vi.fn()}
        onArchive={vi.fn()}
      />
    );
    const promoteAllButton = screen.getByText('Promote all');
    fireEvent.click(promoteAllButton);
    expect(onPromote).toHaveBeenCalledTimes(1);
    const review = onPromote.mock.calls[0][0] as HumanReview;
    expect(review.fields.title.action).toBe('accepted');
  });
});
