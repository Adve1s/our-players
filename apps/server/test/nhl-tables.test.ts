import { describe, expect, it } from 'vitest';
import { mapScore } from '../src/sources/nhl/games';
import { loadFixture } from './fixtures';
import { list, only } from './json';

describe('NHL status and position table rows', () => {
  // The live feed reports OVER between the final horn and FINAL/OFF; the result is not final yet.
  it('maps gameState OVER to LIVE with no endedIn', () => {
    const raw = loadFixture('nhl', 'score', '2026-01-17');
    const g = only(list(raw, 'games'), (x) => x.id === 2025020760, 'raw game 2025020760');
    g.gameState = 'OVER';
    delete g.gameOutcome;
    const mapped = only(
      mapScore(raw).games,
      (x) => x.externalId === '2025020760',
      'game 2025020760',
    );
    expect(mapped.status).toBe('LIVE');
    expect(mapped.endedIn).toBeNull();
  });
});
