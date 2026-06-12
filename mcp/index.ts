/**
 * Signal Scout — stdio MCP server for Claude Desktop / Cursor.
 * Auth: set SIGNALSCOUT_API_KEY (create one in /integrations) — the server scopes
 * every tool to that key's org.
 *
 *   SIGNALSCOUT_API_KEY=ssk_live_... pnpm mcp
 */
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { verifyApiKey } from '@/lib/apikeys/service';
import { MCP_TOOLS } from '@/lib/mcp/tools';

async function main() {
  const apiKey = process.env.SIGNALSCOUT_API_KEY;
  const verified = apiKey ? await verifyApiKey(apiKey) : null;
  if (!verified) {
    console.error('[signal-scout-mcp] Set SIGNALSCOUT_API_KEY to a valid Signal Scout API key (create one in /integrations).');
    process.exit(1);
  }
  const orgId = verified.orgId;

  const server = new McpServer({ name: 'signal-scout', version: '0.1.0' });

  for (const tool of MCP_TOOLS) {
    server.tool(tool.name, tool.description, tool.schema, async (args: Record<string, unknown>) => {
      try {
        const data = await tool.handle(args, orgId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
      }
    });
  }

  await server.connect(new StdioServerTransport());
  console.error('[signal-scout-mcp] ready (stdio)');
}

main().catch((err) => {
  console.error('[signal-scout-mcp] fatal:', err);
  process.exit(1);
});
