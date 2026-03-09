import { apiRequest } from '../config.js';
import { validateId, validateString, validateStringOptional, sanitizeText } from '../validation.js';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const agentTools = [
  {
    name: 'list_agents',
    description:
      'List available AI agents registered with LuminaRaptor28, including their capabilities and categories.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description:
            'Filter agents by category (e.g. business, developer, platform). Omit or pass "all" for no filter.',
        },
      },
    },
  },
  {
    name: 'dispatch_agent',
    description:
      'Send a task to a specific LuminaRaptor28 agent for execution. Returns the agent response and optional quality-gate score.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Agent ID to dispatch the task to',
        },
        task: {
          type: 'string',
          description: 'The task description to send to the agent',
        },
        context: {
          type: 'object',
          description: 'Optional key-value context for the agent',
        },
        action: {
          type: 'string',
          description: 'Optional action hint (e.g. analyze, deploy, review)',
        },
      },
      required: ['agent_id', 'task'],
    },
  },
  {
    name: 'get_agent_status',
    description:
      'Check the execution status, trust score, and performance statistics for a specific agent.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Agent ID to look up',
        },
      },
      required: ['agent_id'],
    },
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleAgentTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'list_agents': {
      const query: Record<string, string> = {};
      const category = validateStringOptional(args.category, 'category', 100);
      if (category && category !== 'all') {
        query.category = category;
      }
      return apiRequest('/api/v1/agents', { query });
    }

    case 'dispatch_agent': {
      const agent_id = validateId(args.agent_id, 'agent_id');
      const task = sanitizeText(validateString(args.task, 'task', 5000));
      const action = validateStringOptional(args.action, 'action', 100);
      return apiRequest('/api/v1/agents/dispatch', {
        method: 'POST',
        body: {
          agent_id,
          task,
          context: args.context || {},
          action: action || 'execute',
        },
      });
    }

    case 'get_agent_status': {
      const agent_id = validateId(args.agent_id, 'agent_id');
      return apiRequest(`/api/v1/agents/${encodeURIComponent(agent_id)}/status`);
    }

    default:
      throw new Error(`Unknown agent tool: ${name}`);
  }
}
