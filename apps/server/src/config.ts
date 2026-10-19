export function loadConfig(env: Record<string, string | undefined>): {
  port: number;
  contactUrl: string;
  schedulerEnabled: boolean;
  corsOrigins: string[];
} {
  const contactUrl = env.CONTACT_URL || 'https://github.com/Adve1s/our-players';
  const schedulerEnabled = env.SCHEDULER_ENABLED === '1';
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const raw = env.PORT;
  if (raw === undefined || raw === '') {
    return { port: 3001, contactUrl, schedulerEnabled, corsOrigins };
  }
  const port = Number(raw);
  // The regex rejects forms Number() accepts ('0x50', '1e3', ' 80') so a typo can't pick a surprise port.
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535, got "${raw}"`);
  }
  return { port, contactUrl, schedulerEnabled, corsOrigins };
}

// Browsers send Origin as exactly scheme://host[:port], so anything else could never match.
function parseCorsOrigins(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (entries.length === 0) return ['http://localhost:8081'];
  for (const entry of entries) {
    if (!URL.canParse(entry) || new URL(entry).origin !== entry) {
      throw new Error(`CORS_ORIGINS: "${entry}" is not an origin (scheme://host[:port])`);
    }
  }
  return entries;
}
