// Endpoint IDs come from the command line and become file names, so they are checked strictly.

export function isoDate(id: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) throw new Error(`Expected a date YYYY-MM-DD, got "${id}"`);
  return id;
}

export function digits(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error(`Expected a numeric ID, got "${id}"`);
  return id;
}

/** `<base>` or `<base>-<season>`, e.g. `TBL` / `TBL-20252026`, `9` / `9-2026`. */
export function withOptionalSeason(id: string, base: RegExp): { base: string; season?: string } {
  const match = new RegExp(`^(${base.source})(?:-(\\d{4,8}))?$`).exec(id);
  if (!match?.[1]) throw new Error(`Unexpected ID "${id}"`);
  return match[2] ? { base: match[1], season: match[2] } : { base: match[1] };
}

export type EndpointMap = Record<string, (id: string) => string>;
