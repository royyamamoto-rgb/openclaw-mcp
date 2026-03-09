/**
 * LuminaRaptor28 MCP Server configuration.
 *
 * All values are resolved from environment variables at runtime
 * so the package stays stateless and portable.
 */

export interface LuminaRaptor28Config {
  /** Base URL of the LuminaRaptor28 API (no trailing slash). */
  apiUrl: string;
  /** API key for authenticating requests to the LuminaRaptor28 API. */
  apiKey: string;
}

export function getConfig(): LuminaRaptor28Config {
  const apiKey = process.env.LUMINARAPTOR28_API_KEY;
  if (!apiKey) {
    console.error('FATAL: LUMINARAPTOR28_API_KEY environment variable is required');
    process.exit(1);
  }

  const apiUrl = (process.env.LUMINARAPTOR28_API_URL || 'http://localhost:1878').replace(/\/+$/, '');
  try {
    new URL(apiUrl);
  } catch {
    console.error('FATAL: LUMINARAPTOR28_API_URL is not a valid URL');
    process.exit(1);
  }

  return { apiUrl, apiKey };
}

/**
 * Perform an authenticated request to the LuminaRaptor28 API.
 *
 * Centralises auth header injection, base-URL resolution, content-type
 * handling, and error surfacing so individual tool files stay lean.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): Promise<T> {
  const { apiUrl, apiKey } = getConfig();
  const method = options.method || 'GET';

  let url = `${apiUrl}${path}`;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Log full error internally but don't expose backend details to clients
      const text = await response.text().catch(() => '');
      console.error(`API error detail: ${method} ${path} HTTP ${response.status} — ${text}`);
      throw new Error(`API request failed: ${method} ${path} returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  } finally {
    clearTimeout(timeout);
  }
}
