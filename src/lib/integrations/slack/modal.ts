/**
 * Block Kit modal builder for the COF capture modal.
 */

export interface ModalPrefill {
  title?: string;
  description?: string;
}

/**
 * Returns a Slack Block Kit modal payload for the node capture form.
 * callback_id is "capture_modal" — used to route view_submission events.
 */
export function buildCaptureModal(
  triggerId: string,
  prefill: ModalPrefill = {},
): object {
  return {
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'capture_modal',
      title: {
        type: 'plain_text',
        text: 'Save to COF',
      },
      submit: {
        type: 'plain_text',
        text: 'Save',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'input',
          block_id: 'title_block',
          label: {
            type: 'plain_text',
            text: 'Title',
          },
          element: {
            type: 'plain_text_input',
            action_id: 'title',
            placeholder: {
              type: 'plain_text',
              text: 'What did you learn or observe?',
            },
            initial_value: prefill.title ?? '',
          },
        },
        {
          type: 'input',
          block_id: 'description_block',
          label: {
            type: 'plain_text',
            text: 'Description',
          },
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'description',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Add context, evidence, or details…',
            },
            initial_value: prefill.description ?? '',
          },
        },
        {
          type: 'input',
          block_id: 'node_type_block',
          label: {
            type: 'plain_text',
            text: 'Type',
          },
          element: {
            type: 'static_select',
            action_id: 'node_type',
            placeholder: {
              type: 'plain_text',
              text: 'Select a type',
            },
            initial_option: {
              text: { type: 'plain_text', text: 'Hunch' },
              value: 'hunch',
            },
            options: [
              { text: { type: 'plain_text', text: 'Hunch' }, value: 'hunch' },
              {
                text: { type: 'plain_text', text: 'Background Assumption' },
                value: 'assumption_background',
              },
              {
                text: { type: 'plain_text', text: 'Foreground Assumption' },
                value: 'assumption_foreground',
              },
              { text: { type: 'plain_text', text: 'Test' }, value: 'test' },
              { text: { type: 'plain_text', text: 'Signal' }, value: 'signal' },
              {
                text: { type: 'plain_text', text: 'Learning' },
                value: 'learning',
              },
              { text: { type: 'plain_text', text: 'Option' }, value: 'option' },
            ],
          },
        },
        {
          type: 'input',
          block_id: 'source_url_block',
          label: {
            type: 'plain_text',
            text: 'Source URL',
          },
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'source_url',
            placeholder: {
              type: 'plain_text',
              text: 'https://…',
            },
          },
        },
      ],
    },
  };
}
