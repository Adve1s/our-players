import { createApiClient } from '@our-players/shared';
import { apiBaseUrl } from '../lib/api-url';
import { withTimeout } from '../lib/timeout-fetch';

// Expo inlines EXPO_PUBLIC_* at build time, but only for this exact `process.env.X` form.
export const api = createApiClient(
  apiBaseUrl(process.env.EXPO_PUBLIC_API_URL),
  withTimeout(fetch, 10_000),
);
