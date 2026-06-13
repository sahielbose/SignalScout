import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodShapeToJsonSchema } from './jsonschema';
import { MCP_TOOLS } from './tools';

describe('zodShapeToJsonSchema', () => {
  it('maps types and tracks required vs optional', () => {
    const js = zodShapeToJsonSchema({
      name: z.string(),
      count: z.number().optional(),
      kind: z.enum(['a', 'b']),
      flag: z.boolean().optional(),
    });
    expect(js.type).toBe('object');
    expect(js.properties.name).toEqual({ type: 'string' });
    expect(js.properties.kind).toEqual({ type: 'string', enum: ['a', 'b'] });
    expect(js.required.sort()).toEqual(['kind', 'name']);
    expect(js.required).not.toContain('count');
  });

  it('every MCP tool produces a valid object schema', () => {
    for (const t of MCP_TOOLS) {
      const js = zodShapeToJsonSchema(t.schema);
      expect(js.type).toBe('object');
      expect(typeof js.properties).toBe('object');
    }
    expect(MCP_TOOLS.map((t) => t.name)).toEqual([
      'search_signals',
      'get_person',
      'generate_dossier',
      'list_signals_for_company',
      'export_list',
      'list_icps',
      'list_companies',
      'list_events',
      'add_person_to_list',
    ]);
  });
});
