import { apiRequest } from '../config.js';
import { validateId, validateString, validateArray, sanitizeText } from '../validation.js';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const orchestrationTools = [
  {
    name: 'run_pipeline',
    description:
      'Execute a multi-agent pipeline by ID. Each step dispatches to an LuminaRaptor28 agent, with output passed to the next step.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pipeline_id: {
          type: 'string',
          description: 'Pipeline ID (e.g. security-audit, lead-to-close, full-deploy)',
        },
        task: {
          type: 'string',
          description: 'Initial task description that starts the pipeline',
        },
        context: {
          type: 'object',
          description: 'Optional key-value context passed to every step',
        },
      },
      required: ['pipeline_id', 'task'],
    },
  },
  {
    name: 'fan_out',
    description:
      'Dispatch the same task to multiple agents in parallel and collect results. Supports merge, best, or all aggregation strategies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of agent IDs to dispatch to',
        },
        task: {
          type: 'string',
          description: 'Task to send to all agents',
        },
        context: {
          type: 'object',
          description: 'Optional key-value context',
        },
        aggregation: {
          type: 'string',
          enum: ['merge', 'best', 'all'],
          description:
            'How to aggregate results: merge (combine outputs), best (fastest successful), all (return full array)',
        },
      },
      required: ['agent_ids', 'task'],
    },
  },
  {
    name: 'create_pipeline',
    description: 'Create a new reusable multi-agent pipeline definition.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Unique pipeline ID (kebab-case)' },
        name: { type: 'string', description: 'Human-readable pipeline name' },
        description: { type: 'string', description: 'What this pipeline does' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number', description: 'Step number (execution order)' },
              agent_id: { type: 'string', description: 'Agent to execute this step' },
              task_template: {
                type: 'string',
                description:
                  'Task template. Use {{task}} for the initial input and {{step_N_output}} for prior step outputs.',
              },
              depends_on: {
                type: 'array',
                items: { type: 'number' },
                description: 'Step numbers this step depends on',
              },
              timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default: 60000)' },
              fallback_agent_id: {
                type: 'string',
                description: 'Agent to use if the primary agent fails',
              },
              max_retries: { type: 'number', description: 'Max retry attempts (default: 1)' },
            },
            required: ['step', 'agent_id', 'task_template'],
          },
          description: 'Ordered pipeline steps with optional dependency declarations',
        },
      },
      required: ['id', 'name', 'description', 'steps'],
    },
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleOrchestrationTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'run_pipeline': {
      const pipeline_id = validateId(args.pipeline_id, 'pipeline_id');
      const task = sanitizeText(validateString(args.task, 'task', 5000));
      return apiRequest('/api/v1/pipelines/run', {
        method: 'POST',
        body: {
          pipeline_id,
          task,
          context: args.context || {},
        },
      });
    }

    case 'fan_out': {
      const agentIds = validateArray(args.agent_ids, 'agent_ids', 10) as string[];
      for (const id of agentIds) validateId(id, 'agent_ids[]');
      const task = sanitizeText(validateString(args.task, 'task', 5000));
      return apiRequest('/api/v1/orchestration/fan-out', {
        method: 'POST',
        body: {
          agent_ids: agentIds,
          task,
          context: args.context || {},
          aggregation: args.aggregation || 'all',
        },
      });
    }

    case 'create_pipeline': {
      const id = validateId(args.id, 'id');
      const pName = validateString(args.name, 'name', 200);
      const description = sanitizeText(validateString(args.description, 'description', 2000));
      const steps = validateArray(args.steps, 'steps', 20);
      return apiRequest('/api/v1/pipelines', {
        method: 'POST',
        body: { id, name: pName, description, steps },
      });
    }

    default:
      throw new Error(`Unknown orchestration tool: ${name}`);
  }
}
