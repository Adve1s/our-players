import { ApiError } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorMessage } from '../src/lib/errors';

describe('errorMessage', () => {
  it('says the server had a problem for an ApiError', () => {
    expect(errorMessage(new ApiError(500, 'INTERNAL', 'boom'))).toBe(
      'The server had a problem. Try again in a moment.',
    );
  });

  // The server answered, but with a body the contract rejects (drift) or that isn't JSON (a proxy page).
  it.each([
    ['a ZodError', z.number().safeParse('x').error],
    ['a SyntaxError', new SyntaxError('Unexpected token <')],
  ])('says the server had a problem for %s', (_kind, error) => {
    expect(errorMessage(error)).toBe('The server had a problem. Try again in a moment.');
  });

  it.each([new TypeError('Failed to fetch'), new Error('x'), 'weird'])(
    "says it can't reach the server for %s",
    (error) => {
      expect(errorMessage(error)).toBe(
        "Can't reach the server. Check your connection and try again.",
      );
    },
  );
});
