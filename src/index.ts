#!/usr/bin/env node

/**
 * LuminaRaptor28 MCP Server
 *
 * Exposes AI agent orchestration, multi-agent pipelines, RAG knowledge
 * retrieval, and workflow automation as Model Context Protocol tools.
 *
 * https://github.com/lumina28/luminaraptor28-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, type IncomingMessage } from 'http';

import { orchestrationTools, handleOrchestrationTool } from './tools/orchestration.js';
import { agentTools, handleAgentTool } from './tools/agents.js';
import { knowledgeTools, handleKnowledgeTool } from './tools/knowledge.js';
import { workflowTools, handleWorkflowTool } from './tools/workflows.js';

// ---------------------------------------------------------------------------
// Aggregate tools & build handler lookup
// ---------------------------------------------------------------------------

const allTools = [
  ...orchestrationTools,
  ...agentTools,
  ...knowledgeTools,
  ...workflowTools,
];

type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {};
for (const tool of orchestrationTools) toolHandlers[tool.name] = handleOrchestrationTool;
for (const tool of agentTools) toolHandlers[tool.name] = handleAgentTool;
for (const tool of knowledgeTools) toolHandlers[tool.name] = handleKnowledgeTool;
for (const tool of workflowTools) toolHandlers[tool.name] = handleWorkflowTool;

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-IP)
// ---------------------------------------------------------------------------

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

function createMcpServer(): Server {
  const srv = new Server(
    { name: 'luminaraptor28-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  srv.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  srv.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];

    if (!handler) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await handler(name, (args || {}) as Record<string, unknown>);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return srv;
}

// ---------------------------------------------------------------------------
// Connect via stdio or Streamable HTTP transport
// ---------------------------------------------------------------------------

const PORT = process.env.PORT;

if (PORT) {
  // Optional bearer token auth — enforced if set (self-hosting), skipped if unset (MCPize container mode
  // where the gateway handles subscriber authentication and network isolation protects the container)
  const SERVER_TOKEN = process.env.LUMINARAPTOR28_SERVER_TOKEN || '';

  // Streamable HTTP mode for cloud hosting (MCPize, etc.)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  const server = createMcpServer();
  await server.connect(transport);

  const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const clientIp = getClientIp(req);

    // Rate limit all endpoints
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests' }));
      return;
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/mcp') {
      // Bearer token auth — only enforced when SERVER_TOKEN is configured
      if (SERVER_TOKEN) {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token || token !== SERVER_TOKEN) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      }
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  httpServer.listen(Number(PORT), BIND_HOST, () => {
    console.error(`LuminaRaptor28 MCP Server listening on ${BIND_HOST}:${PORT} (Streamable HTTP at /mcp)`);
  });
} else {
  // Stdio mode for local use (Claude Desktop, Cline, etc.)
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
