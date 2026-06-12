import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyApiKey } from '@/lib/apikeys/service';
import { MCP_TOOLS, getTool } from '@/lib/mcp/tools';
import { zodShapeToJsonSchema } from '@/lib/mcp/jsonschema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'signal-scout', version: '0.1.0' };

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export async function GET() {
  // simple liveness / discovery
  return NextResponse.json({ server: SERVER_INFO, protocol: PROTOCOL_VERSION, transport: 'streamable-http' });
}

export async function POST(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const verified = header.toLowerCase().startsWith('bearer ') ? await verifyApiKey(header.slice(7).trim()) : null;
  if (!verified) {
    return NextResponse.json(rpcError(null, -32001, 'unauthorized: provide a valid Bearer API key'), { status: 401 });
  }
  const orgId = verified.orgId;

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'parse error'), { status: 400 });
  }

  const { id, method, params } = body;

  switch (method) {
    case 'initialize':
      return NextResponse.json(
        rpcResult(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO }),
      );
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return new Response(null, { status: 202 });
    case 'ping':
      return NextResponse.json(rpcResult(id, {}));
    case 'tools/list':
      return NextResponse.json(
        rpcResult(id, {
          tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: zodShapeToJsonSchema(t.schema) })),
        }),
      );
    case 'tools/call': {
      const name = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      const tool = getTool(name);
      if (!tool) return NextResponse.json(rpcError(id, -32602, `unknown tool: ${name}`));
      const parsed = z.object(tool.schema).safeParse(args);
      if (!parsed.success) {
        return NextResponse.json(
          rpcResult(id, { content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}` }], isError: true }),
        );
      }
      try {
        const data = await tool.handle(parsed.data as Record<string, unknown>, orgId);
        return NextResponse.json(rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }));
      } catch (err) {
        return NextResponse.json(rpcResult(id, { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }], isError: true }));
      }
    }
    default:
      return NextResponse.json(rpcError(id, -32601, `method not found: ${method}`));
  }
}
