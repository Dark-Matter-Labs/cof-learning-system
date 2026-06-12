/**
 * Triage for nodes extracted as children of a document/meeting capture.
 *
 * Single captures already run through a maturity gate that auto-promotes
 * confident extractions and flags the rest. Children previously bypassed this
 * (all forced to 'llm_reviewed'). This applies the same idea using the
 * confidence the extractor reports per child: confident children
 * (>= CHILD_AUTO_PROMOTE_CONFIDENCE) auto-promote; the rest land in the review
 * inbox flagged for one-tap review.
 */
export const CHILD_AUTO_PROMOTE_CONFIDENCE = 4;

export function childReviewStatus(confidenceLevel: number): 'promoted' | 'flagged_for_review' {
  return confidenceLevel >= CHILD_AUTO_PROMOTE_CONFIDENCE ? 'promoted' : 'flagged_for_review';
}
