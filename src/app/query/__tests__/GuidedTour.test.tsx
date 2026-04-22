import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuidedTour } from '../GuidedTour';

const mockNodes = [
  { id: 'gs1', node_type: 'goal_space', title: 'Madrid Goal', description: null, status: 'raw' as const },
];

const mockTourResponse = {
  chapters: [
    { title: 'Our goals', narrative: 'We have one goal space.', nodeIds: ['gs1'] },
    { title: 'Key assumptions', narrative: 'No assumptions yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'No active tests.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing learned yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing pending.', nodeIds: [] },
  ],
};

describe('GuidedTour', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Start guided tour button in idle state', () => {
    render(<GuidedTour allNodes={mockNodes} />);
    expect(screen.getByRole('button', { name: 'Start guided tour' })).toBeDefined();
  });

  it('shows loading skeleton after clicking Start', async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  it('shows static chapter 1 "What is this system?" after load', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(screen.getAllByText('What is this system?').length).toBeGreaterThan(0);
    });
  });

  it('shows all 6 chapter buttons in sidebar after load', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    expect(screen.getByText('Key assumptions')).toBeDefined();
    expect(screen.getByText('Where attention is needed')).toBeDefined();
  });

  it('shows node card for node referenced in active chapter', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    fireEvent.click(screen.getByText('Our goals'));
    await waitFor(() => {
      expect(screen.getByText('Madrid Goal')).toBeDefined();
    });
  });

  it('shows Retry button on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });
  });

  it('shows Next chapter button when not on last chapter', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getAllByText('What is this system?'));
    // Chapter 1 (index 0) is not the last — "Next chapter →" should appear
    expect(screen.getByRole('button', { name: /Next chapter/i })).toBeDefined();
  });

  it('does not show Next chapter button on last chapter', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Where attention is needed'));
    // Navigate to last chapter (index 5)
    fireEvent.click(screen.getByText('Where attention is needed'));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Next chapter/i })).toBeNull();
    });
  });

  it('does not re-fetch when navigating between chapters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTourResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    global.fetch = fetchMock;
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    // Navigate to multiple chapters
    fireEvent.click(screen.getByText('Our goals'));
    fireEvent.click(screen.getByText('Key assumptions'));
    // fetch should only have been called once (the initial load)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
