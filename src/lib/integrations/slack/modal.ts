/**
 * Block Kit modal definition for the COF capture form.
 *
 * Used for both slash command and message shortcut captures.
 * Message shortcut pre-fills title and source_url.
 */

export interface ModalPrefill {
  readonly title?: string;
  readonly sourceUrl?: string;
}

export interface CaptureModalValues {
  readonly title: string;
  readonly description: string | null;
  readonly nodeType: string;
  readonly sourceUrl: string | null;
}

/** Node types available for selection in the capture modal. */
const NODE_TYPE_OPTIONS = [
  { text: 'Hunch', value: 'hunch' },
  { text: 'Assumption', value: 'assumption_foreground' },
  { text: 'Signal', value: 'signal' },
  { text: 'Learning', value: 'learning' },
  { text: 'Option', value: 'option' },
] as const;

/**
 * Builds the Block Kit view payload for the capture modal.
 *
 * @param prefill - Optional values to pre-populate (from message shortcut)
 */
export function buildCaptureModal(prefill: ModalPrefill = {}): Record<string, unknown> {
  return {
    type: 'modal',
    callback_id: 'cof_capture_modal',
    title: {
      type: 'plain_text',
      text: 'Capture to COF',
    },
    submit: {
      type: 'plain_text',
      text: 'Capture',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'title_block',
        label: { type: 'plain_text', text: 'Title' },
        element: {
          type: 'plain_text_input',
          action_id: 'title_input',
          placeholder: { type: 'plain_text', text: 'What did you capture?' },
          initial_value: prefill.title ?? '',
        },
      },
      {
        type: 'input',
        block_id: 'node_type_block',
        label: { type: 'plain_text', text: 'Type' },
        element: {
          type: 'static_select',
          action_id: 'node_type_select',
          placeholder: { type: 'plain_text', text: 'Select a type' },
          initial_option: {
            text: { type: 'plain_text', text: 'Hunch' },
            value: 'hunch',
          },
          options: NODE_TYPE_OPTIONS.map((opt) => ({
            text: { type: 'plain_text', text: opt.text },
            value: opt.value,
          })),
        },
      },
      {
        type: 'input',
        block_id: 'description_block',
        label: { type: 'plain_text', text: 'Description (optional)' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'description_input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Any additional context...',
          },
        },
      },
      {
        type: 'input',
        block_id: 'source_url_block',
        label: { type: 'plain_text', text: 'Source URL (optional)' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'source_url_input',
          placeholder: { type: 'plain_text', text: 'https://...' },
          initial_value: prefill.sourceUrl ?? '',
        },
      },
    ],
  };
}

/**
 * Extracts user-submitted values from a Slack view_submission payload's state.
 *
 * @param values - The `view.state.values` object from the Slack payload
 */
export function parseCaptureModalValues(
  values: Record<string, Record<string, { value?: string; selected_option?: { value: string } }>>
): CaptureModalValues {
  const title = values['title_block']?.['title_input']?.value ?? '';
  const description = values['description_block']?.['description_input']?.value ?? null;
  const nodeType =
    values['node_type_block']?.['node_type_select']?.selected_option?.value ?? 'hunch';
  const sourceUrl = values['source_url_block']?.['source_url_input']?.value ?? null;

  return {
    title: title.trim(),
    description: description?.trim() ?? null,
    nodeType,
    sourceUrl: sourceUrl?.trim() || null,
  };
}
