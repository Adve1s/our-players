import { z } from 'zod';

export interface Config {
  port: number;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  return { port: parsed.data.PORT };
}
