import { ApiError } from '@our-players/shared';
import { ZodError } from 'zod';

// The server answered: an error status, a body the contract rejects, or a body that isn't JSON.
// Anything else (fetch TypeError, timeout abort) means it didn't.
export function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof ZodError || error instanceof SyntaxError
    ? 'The server had a problem. Try again in a moment.'
    : "Can't reach the server. Check your connection and try again.";
}
