import { apiRequest } from '../config.js';
import { validateId, validateString, validateStringOptional, validateNumber, validateArray, sanitizeText } from '../validation.js';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const knowledgeTools = [
  {
    name: 'search_knowledge',
    description:
      'Search the LuminaRaptor28 RAG knowledge base for solutions, patterns, and agent learnings.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language search query',
        },
        domain: {
          type: 'string',
          description: 'Filter by domain (e.g. engineering, business, security, operations)',
        },
        agent_id: {
          type: 'string',
          description: 'Filter by the agent that contributed the knowledge',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by one or more tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_knowledge',
    description:
      'Add a new document or problem-solution pair to the LuminaRaptor28 knowledge base.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'ID of the agent contributing this knowledge',
        },
        domain: {
          type: 'string',
          description: 'Domain (e.g. engineering, business, security, operations)',
        },
        problem_summary: {
          type: 'string',
          description: 'Brief description of the problem',
        },
        solution_summary: {
          type: 'string',
          description: 'Brief description of the solution',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorisation and retrieval',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score between 0.0 and 1.0 (default: 0.8)',
        },
      },
      required: ['agent_id', 'domain', 'problem_summary', 'solution_summary', 'tags'],
    },
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleKnowledgeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'search_knowledge': {
      const query = sanitizeText(validateString(args.query, 'query', 2000));
      const domain = validateStringOptional(args.domain, 'domain', 100);
      const agent_id = args.agent_id !== undefined ? validateId(args.agent_id, 'agent_id') : undefined;
      const tags = args.tags !== undefined ? validateArray(args.tags, 'tags', 10) as string[] : undefined;
      const limit = args.limit !== undefined ? validateNumber(args.limit, 'limit', 1, 50) : undefined;

      const body: Record<string, unknown> = { query };
      if (domain) body.domain = domain;
      if (agent_id) body.agent_id = agent_id;
      if (tags) body.tags = tags;
      if (limit) body.limit = limit;

      return apiRequest('/api/v1/knowledge/search', {
        method: 'POST',
        body,
      });
    }

    case 'add_knowledge': {
      const agent_id = validateId(args.agent_id, 'agent_id');
      const domain = validateString(args.domain, 'domain', 100);
      const problem_summary = sanitizeText(validateString(args.problem_summary, 'problem_summary', 5000));
      const solution_summary = sanitizeText(validateString(args.solution_summary, 'solution_summary', 5000));
      const tags = validateArray(args.tags, 'tags', 10) as string[];
      const confidence = args.confidence !== undefined ? validateNumber(args.confidence, 'confidence', 0, 1) : 0.8;

      return apiRequest('/api/v1/knowledge', {
        method: 'POST',
        body: {
          agent_id,
          domain,
          problem_summary,
          solution_summary,
          tags,
          confidence,
        },
      });
    }

    default:
      throw new Error(`Unknown knowledge tool: ${name}`);
  }
}
