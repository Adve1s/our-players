import { ApiError } from '@our-players/shared';

// An ApiError means the server answered; anything else (fetch TypeError, timeout) means it didn't.
export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? 'The server had a problem. Try again in a moment.'
    : "Can't reach the server. Check your connection and try again.";
}
