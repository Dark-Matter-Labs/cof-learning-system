import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuidedTour } from '../GuidedTour';

const mockNodes = [
  { id: 'gs1', node_type: 'goal_space', title: 'Madrid Goal', description: null, status: 'raw' as const },
];

const mockTour = {
  chapters: [
    { title: 'Our goals', narrative: 'We have one goal space.', nodeIds: ['gs1'] },
    { title: 'Key assumptions', narrative: 'No assumptions yet.', nodeIds: [] },
    { title: "What we're testing", narrative: 'No active tests.', nodeIds: [] },
    { title: "What we've learned", narrative: 'Nothing learned yet.', nodeIds: [] },
    { title: 'Where attention is needed', narrative: 'Nothing pending.', nodeIds: [] },
  ],
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** No cached tour on GET (→ idle). On POST, run `post()` to produce the response. */
function mockFetch(post: () => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn((_url: string, opts?: { method?: string }) => {
    if (opts?.method === 'POST') return Promise.resolve(post());
    return Promise.resolve(jsonResponse({ tour: null, generatedAt: null }));
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const generatedTour = () => jsonResponse({ tour: mockTour, generatedAt: '2026-01-01T00:00:00.000Z' });

describe('GuidedTour', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Start guided tour button in idle state', async () => {
    mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start guided tour' })).toBeDefined();
    });
  });

  it('shows loading skeleton after clicking Start', async () => {
    // GET resolves to idle; POST never resolves → stays in the generating skeleton.
    mockFetch(() => new Promise<Response>(() => {}));
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  it('shows static chapter 1 "What is this system?" after load', async () => {
    mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(screen.getAllByText('What is this system?').length).toBeGreaterThan(0);
    });
  });

  it('shows all 6 chapter buttons in sidebar after load', async () => {
    mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    // Static chapter 1 appears in both the sidebar and the active heading.
    expect(screen.getAllByText('What is this system?').length).toBeGreaterThan(0);
    expect(screen.getByText('Key assumptions')).toBeDefined();
    expect(screen.getByText('Where attention is needed')).toBeDefined();
  });

  it('shows node card for node referenced in active chapter', async () => {
    mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    fireEvent.click(screen.getByText('Our goals'));
    await waitFor(() => {
      expect(screen.getByText('Madrid Goal')).toBeDefined();
    });
  });

  it('shows Retry button on API failure', async () => {
    mockFetch(() => new Response('', { status: 500 }));
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });
  });

  it('shows Next chapter button when not on last chapter', async () => {
    mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getAllByText('What is this system?'));
    // Chapter 1 (index 0) is not the last — "Next chapter →" should appear
    expect(screen.getByRole('button', { name: /Next chapter/i })).toBeDefined();
  });

  it('does not show Next chapter button on last chapter', async () => {
    mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Where attention is needed'));
    // Navigate to last chapter (static chapter + 5 LLM chapters → index 5)
    fireEvent.click(screen.getByText('Where attention is needed'));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Next chapter/i })).toBeNull();
    });
  });

  it('does not re-fetch when navigating between chapters', async () => {
    const fetchMock = mockFetch(generatedTour);
    render(<GuidedTour allNodes={mockNodes} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start guided tour' }));
    await waitFor(() => screen.getByText('Our goals'));
    const callsAfterLoad = fetchMock.mock.calls.length;
    // Navigate between chapters — must not trigger additional fetches.
    fireEvent.click(screen.getByText('Our goals'));
    fireEvent.click(screen.getByText('Key assumptions'));
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterLoad);
  });
});
