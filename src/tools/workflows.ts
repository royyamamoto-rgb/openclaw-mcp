import { apiRequest } from '../config.js';
import { validateId, validateString } from '../validation.js';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const workflowTools = [
  {
    name: 'trigger_workflow',
    description:
      'Trigger an n8n workflow by ID, optionally passing input data. Returns the execution result.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflow_id: {
          type: 'string',
          description: 'The n8n workflow ID to trigger',
        },
        data: {
          type: 'object',
          description: 'Optional input data to pass to the workflow',
        },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'list_workflows',
    description:
      'List available n8n workflows with their active/inactive status and recent execution stats.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        active_only: {
          type: 'boolean',
          description: 'If true, only return active workflows. Default: false',
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleWorkflowTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'trigger_workflow': {
      const workflow_id = validateId(args.workflow_id, 'workflow_id');

      // Validate data object: max 20 keys, serialized max 10000 chars
      let data = args.data || {};
      if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data as Record<string, unknown>);
        if (keys.length > 20) {
          throw new Error('data exceeds maximum of 20 keys');
        }
        const serialized = JSON.stringify(data);
        if (serialized.length > 10000) {
          throw new Error('data exceeds maximum serialized length of 10000 characters');
        }
      } else {
        data = {};
      }

      return apiRequest('/api/v1/workflows/trigger', {
        method: 'POST',
        body: { workflow_id, data },
      });
    }

    case 'list_workflows': {
      const query: Record<string, string> = {};
      if (args.active_only) {
        query.active_only = 'true';
      }
      return apiRequest('/api/v1/workflows', { query });
    }

    default:
      throw new Error(`Unknown workflow tool: ${name}`);
  }
}
