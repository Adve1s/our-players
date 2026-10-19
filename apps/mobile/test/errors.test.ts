import { ApiError } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { errorMessage } from '../src/lib/errors';

describe('errorMessage', () => {
  it('says the server had a problem for an ApiError', () => {
    expect(errorMessage(new ApiError(500, 'INTERNAL', 'boom'))).toBe(
      'The server had a problem. Try again in a moment.',
    );
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
