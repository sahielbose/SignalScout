import { z } from 'zod';

interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}

function fieldSchema(schema: z.ZodTypeAny): { json: unknown; required: boolean } {
  let required = true;
  let s = schema;
  if (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
    required = false;
    s = s._def.innerType;
  }
  if (s instanceof z.ZodString) return { json: { type: 'string' }, required };
  if (s instanceof z.ZodNumber) return { json: { type: 'number' }, required };
  if (s instanceof z.ZodBoolean) return { json: { type: 'boolean' }, required };
  if (s instanceof z.ZodEnum) return { json: { type: 'string', enum: s._def.values }, required };
  if (s instanceof z.ZodArray) return { json: { type: 'array', items: fieldSchema(s._def.type).json }, required };
  return { json: {}, required };
}

/** Convert a zod raw shape to a JSON Schema object (MCP tools/list inputSchema). */
export function zodShapeToJsonSchema(shape: z.ZodRawShape): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    const { json, required: req } = fieldSchema(value as z.ZodTypeAny);
    properties[key] = json;
    if (req) required.push(key);
  }
  return { type: 'object', properties, required, additionalProperties: false };
}
