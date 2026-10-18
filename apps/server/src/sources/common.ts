import { z } from 'zod';

// Helpers every adapter shares; `source` is the message prefix ("nhl", "espn-nba").

export function parsePayload<T>(
  source: string,
  schema: z.ZodType<T>,
  endpoint: string,
  raw: unknown,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${source} ${endpoint}: invalid payload\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// hasOwn, so inherited keys like 'constructor' are not table rows.
export function lookup<V>(table: Readonly<Record<string, V>>, key: string | number): V | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
