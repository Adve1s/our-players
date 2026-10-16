export function loadConfig(env: Record<string, string | undefined>): { port: number } {
  const raw = env.PORT;
  if (raw === undefined || raw === '') return { port: 3001 };
  const port = Number(raw);
  // The regex rejects forms Number() accepts ('0x50', '1e3', ' 80') so a typo can't pick a surprise port.
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535, got "${raw}"`);
  }
  return { port };
}
