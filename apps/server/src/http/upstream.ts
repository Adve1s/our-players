import { type Config, userAgent } from '../config';
import { createPoliteClient, type PoliteClient } from './polite-client';

let shared: PoliteClient | undefined;

/**
 * The polite client every upstream call goes through. One per process: the per-host rate limit
 * lives in the instance, so two clients would each send their own 1 request/s to the same host.
 * The first caller's config wins.
 */
export function upstreamClient(config: Config): PoliteClient {
  shared ??= createPoliteClient({ userAgent: userAgent(config) });
  return shared;
}
