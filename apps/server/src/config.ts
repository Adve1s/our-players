export function loadConfig(env: Record<string, string | undefined>): {
  port: number;
  contactUrl: string;
  schedulerEnabled: boolean;
} {
  const contactUrl = env.CONTACT_URL || 'https://github.com/Adve1s/our-players';
  const schedulerEnabled = env.SCHEDULER_ENABLED === '1';
  const raw = env.PORT;
  if (raw === undefined || raw === '') return { port: 3001, contactUrl, schedulerEnabled };
  const port = Number(raw);
  // The regex rejects forms Number() accepts ('0x50', '1e3', ' 80') so a typo can't pick a surprise port.
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535, got "${raw}"`);
  }
  return { port, contactUrl, schedulerEnabled };
}
