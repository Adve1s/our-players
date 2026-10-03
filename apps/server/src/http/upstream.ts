import { type Config, userAgent } from '../config';
import { createPoliteClient, type PoliteClient } from './polite-client';

/** The polite client every upstream call goes through, configured for production use. */
export function createUpstreamClient(config: Config): PoliteClient {
  return createPoliteClient({ userAgent: userAgent(config) });
}
