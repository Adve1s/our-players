import { z } from 'zod';
import serverPackage from '../package.json' with { type: 'json' };

export interface Config {
  port: number;
  contactUrl: string;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CONTACT_URL: z.url().default('https://github.com/Adve1s/our-players'),
});

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  return { port: parsed.data.PORT, contactUrl: parsed.data.CONTACT_URL };
}

// Upstream operators can see who we are and how to reach us.
export function userAgent(config: Config): string {
  return `OurPlayers/${serverPackage.version} (+${config.contactUrl})`;
}
