import { expect, it } from 'vitest';

it('a real fetch fails in tests', async () => {
  await expect(fetch('https://api-web.nhle.com/v1/score/2026-03-24')).rejects.toThrow(
    /network disabled in tests/,
  );
});
