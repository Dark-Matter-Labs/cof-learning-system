import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskMode } from '../AskMode';

const mockNodes = [
  { id: 'n1', node_type: 'hunch', title: 'Madrid hunch', description: null, status: 'raw' as const },
];

function makeStreamResponse(text: string, nodeIds: string[] = []) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Context-Nodes': JSON.stringify(nodeIds),
    },
  });
}

describe('AskMode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty-state prompt', () => {
    render(<AskMode allNodes={mockNodes} />);
    expect(screen.getByText('Ask anything about the knowledge graph')).toBeDefined();
  });

  it('renders text input with placeholder', () => {
    render(<AskMode allNodes={mockNodes} />);
    expect(screen.getByPlaceholderText('Ask a question…')).toBeDefined();
  });

  it('Ask button is disabled when input is empty', () => {
    render(<AskMode allNodes={mockNodes} />);
    const btn = screen.getByRole('button', { name: 'Ask' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Ask button becomes enabled when input has text', () => {
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'What is Madrid?' } });
    const btn = screen.getByRole('button', { name: 'Ask' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('displays user message in chat after submitting', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('The answer.', []));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'What is Madrid?' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('What is Madrid?')).toBeDefined();
    });
  });

  it('displays assistant response after stream completes', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('The answer is 42.', []));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'Tell me something' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('The answer is 42.')).toBeDefined();
    });
  });

  it('shows referenced node cards after response with matching node IDs', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('Here is what I found.', ['n1']));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'Tell me about Madrid' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Madrid hunch')).toBeDefined();
    });
  });

  it('clears input after submitting', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeStreamResponse('Response.', []));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My question' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows error message when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<AskMode allNodes={mockNodes} />);
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'My question' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeDefined();
    });
  });

  it('sends full history on follow-up questions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeStreamResponse('Answer.', []));
    global.fetch = fetchMock;
    render(<AskMode allNodes={mockNodes} />);

    // First question
    const input = screen.getByPlaceholderText('Ask a question…');
    fireEvent.change(input, { target: { value: 'First question' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByText('First question')).toBeDefined());

    // Second question
    fireEvent.change(input, { target: { value: 'Follow up' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondCall = fetchMock.mock.calls[1][1] as { body: string };
      const body = JSON.parse(secondCall.body) as { query: string; history: Array<{ role: string; content: string }> };
      expect(body.history.length).toBeGreaterThan(0);
      expect(body.query).toBe('Follow up');
    });
  });
});
