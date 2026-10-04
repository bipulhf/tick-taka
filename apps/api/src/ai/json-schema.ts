import { z } from "zod";

type JsonNode = Record<string, unknown>;

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const copy: JsonNode = {};
  for (const [key, value] of Object.entries(node as JsonNode)) {
    if (key === "$schema") continue;
    copy[key] = strictify(value);
  }
  if (copy.type === "object" && copy.properties && typeof copy.properties === "object") {
    copy.additionalProperties = false;
    copy.required = Object.keys(copy.properties as JsonNode);
  }
  return copy;
}

/**
 * JSON schema for OpenAI Structured Outputs (strict mode), built from the same Zod
 * schemas the API validates with: every property required, no extra properties.
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return strictify(z.toJSONSchema(schema, { io: "output", unrepresentable: "any" })) as Record<
    string,
    unknown
  >;
}
