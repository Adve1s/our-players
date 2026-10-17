import { describe, expect, it } from 'vitest';
import { mapScore } from '../src/sources/nhl/games';
import { mapRoster } from '../src/sources/nhl/players';
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

  it('maps positionCode R (Rust, PIT roster) to a forward', () => {
    const { players } = mapRoster(loadFixture('nhl', 'roster', 'PIT'), '5');
    const rust = only(players, (p) => p.externalId === '8475810', 'Rust');
    expect(rust.position).toBe('R');
    expect(rust.positionGroup).toBe('forward');
  });
});
