import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineCaptureCard } from '../InlineCaptureCard';
import { vi, beforeEach } from 'vitest';
import type { Node } from '@/lib/types/nodes';

global.fetch = vi.fn();

const DEFAULT_PROPS = {
  position: { x: 100, y: 200 },
  onClose: vi.fn(),
  onCreated: vi.fn(),
  goalSpaces: [],
  triggerOutcomes: [],
} as const;

const mockNode = (overrides: Partial<Node> = {}): Node => ({
  id: 'node-1',
  node_type: 'hunch',
  title: 'Test',
  description: null,
  content: null,
  hunch_type: null,
  confidence_level: null,
  confidence_basis: null,
  status: 'raw',
  llm_extraction: null,
  llm_review: null,
  human_review: null,
  author_id: null,
  parent_node_id: null,
  domain_tags: [],
  external_links: [],
  attachments: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

it('renders at given position', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} />);
  expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
});

it('calls onClose when Escape pressed', () => {
  const onClose = vi.fn();
  render(<InlineCaptureCard {...DEFAULT_PROPS} onClose={onClose} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('disables Create button when title is empty', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} />);
  expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
});

it('submits on Create click with valid title', async () => {
  const createdNode = { id: 'new-id', title: 'Test' };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: createdNode }),
  });
  const onCreated = vi.fn();
  render(<InlineCaptureCard {...DEFAULT_PROPS} onCreated={onCreated} />);
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-id'));
});

it('shows goal space dropdown when trigger_outcome type selected', () => {
  const goalSpaces = [
    mockNode({ id: 'gs-1', title: 'Formation capital', node_type: 'goal_space' }),
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} goalSpaces={goalSpaces} defaultNodeType="trigger_outcome" />);
  expect(screen.getByText(/which goal space/i)).toBeInTheDocument();
  expect(screen.getByText('Formation capital')).toBeInTheDocument();
});

it('does not show goal space dropdown for non-trigger_outcome types', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} defaultNodeType="hunch" />);
  expect(screen.queryByText(/which goal space/i)).not.toBeInTheDocument();
});

// Task 2 new tests: outcome dropdown

it('renders outcome dropdown for hunch type when triggerOutcomes provided', () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="hunch" />);
  expect(screen.getByText(/which outcome does this target/i)).toBeInTheDocument();
});

it('renders outcome dropdown for intervention type', () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="intervention" />);
  expect(screen.getByText(/which outcome does this target/i)).toBeInTheDocument();
});

it('renders outcome dropdown for signal type', () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="signal" />);
  expect(screen.getByText(/which outcome does this target/i)).toBeInTheDocument();
});

it('does NOT render outcome dropdown for commitment type', () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="commitment" />);
  expect(screen.queryByText(/which outcome does this target/i)).not.toBeInTheDocument();
});

it('does NOT render outcome dropdown for test type', () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="test" />);
  expect(screen.queryByText(/which outcome does this target/i)).not.toBeInTheDocument();
});

it('when hunch with triggerOutcomeId selected, POSTs targets_outcome edge', async () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  const createdNode = { id: 'new-id', title: 'Test' };
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  // First call: capture POST, second call: edge POST
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: createdNode }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="hunch" />);
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });

  // Select the outcome
  const outcomeSelect = screen.getByDisplayValue('— None —');
  fireEvent.change(outcomeSelect, { target: { value: 'to-1' } });

  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const edgeCall = fetchMock.mock.calls[1];
  expect(edgeCall[0]).toBe('/api/graph/edges');
  const edgeBody = JSON.parse(edgeCall[1].body);
  expect(edgeBody.edge_type).toBe('targets_outcome');
  expect(edgeBody.target_id).toBe('to-1');
  expect(edgeBody.source_id).toBe('new-id');
});

it('when signal with triggerOutcomeId selected, POSTs indicates_progress edge', async () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  const createdNode = { id: 'new-id', title: 'Test' };
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: createdNode }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="signal" />);
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test signal' } });

  const outcomeSelect = screen.getByDisplayValue('— None —');
  fireEvent.change(outcomeSelect, { target: { value: 'to-1' } });

  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const edgeCall = fetchMock.mock.calls[1];
  const edgeBody = JSON.parse(edgeCall[1].body);
  expect(edgeBody.edge_type).toBe('indicates_progress');
});

it('renders expected signals text field for hunch type', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} defaultNodeType="hunch" />);
  expect(screen.getByText(/what signal would tell you this is working/i)).toBeInTheDocument();
});

it('renders expected signals text field for intervention type', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} defaultNodeType="intervention" />);
  expect(screen.getByText(/what signal would tell you this is working/i)).toBeInTheDocument();
});

it('renders expected signals text field for signal type', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} defaultNodeType="signal" />);
  expect(screen.getByText(/what signal would tell you this is working/i)).toBeInTheDocument();
});

it('includes content.expected_signals in capture POST when provided', async () => {
  const createdNode = { id: 'new-id', title: 'Test' };
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: createdNode }) });

  render(<InlineCaptureCard {...DEFAULT_PROPS} defaultNodeType="hunch" />);
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });

  const signalInput = screen.getByPlaceholderText(/e\.g\. investments increase/i);
  fireEvent.change(signalInput, { target: { value: 'Investor interest spikes' } });

  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const captureBody = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(captureBody.content).toEqual({ expected_signals: 'Investor interest spikes' });
});

it('does not POST edge when no outcome selected', async () => {
  const triggerOutcomes = [
    mockNode({ id: 'to-1', title: 'Raise £10M', node_type: 'trigger_outcome' }),
  ];
  const createdNode = { id: 'new-id', title: 'Test' };
  const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: createdNode }) });

  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={triggerOutcomes} defaultNodeType="hunch" />);
  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Test hunch' } });
  // Do NOT select any outcome
  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe('/api/capture');
});

it('shows empty state message when triggerOutcomes is empty array', () => {
  render(<InlineCaptureCard {...DEFAULT_PROPS} triggerOutcomes={[]} defaultNodeType="hunch" />);
  expect(screen.getByText(/no trigger outcomes yet/i)).toBeInTheDocument();
});
