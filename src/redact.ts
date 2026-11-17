// Masking of captured span data: listed keys never leave n8n with their values.

export const REDACTED = "[REDACTED]";
export const DEFAULT_REDACT_KEYS =
  "authorization,proxy-authorization,cookie,set-cookie,x-api-key,api-key,apikey,x-auth-token";

/**
 * Key names whose values never leave n8n in a span (case-insensitive).
 * N8N_OTEL_REDACT_KEYS replaces the default list; set it to an empty string to turn masking off.
 */
export function redactKeys(): Set<string> {
  const raw = process.env.N8N_OTEL_REDACT_KEYS ?? DEFAULT_REDACT_KEYS;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * A copy of `value` with the value of every listed key replaced by "[REDACTED]", at any depth.
 * n8n's name/value pairs ({ name: "Authorization", value: "..." }, as in HTTP Request header
 * parameters) are masked by their `name`. The input is never mutated.
 */
export function redact(value: unknown, keys: Set<string> = redactKeys()): unknown {
  if (keys.size === 0) return value;
  // Only ancestors stop the walk (a cycle); an object shared by two branches is masked in both.
  const ancestors = new Set<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (ancestors.has(v as object)) return "[Circular]";
    ancestors.add(v as object);
    try {
      if (Array.isArray(v)) return v.map(walk);
      const o = v as Record<string, unknown>;
      const pairName = typeof o["name"] === "string" ? (o["name"] as string).toLowerCase() : undefined;
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(o)) {
        if (keys.has(k.toLowerCase()) || (k === "value" && pairName !== undefined && keys.has(pairName))) {
          out[k] = REDACTED;
        } else {
          out[k] = walk(val);
        }
      }
      return out;
    } finally {
      ancestors.delete(v as object);
    }
  };
  return walk(value);
}
