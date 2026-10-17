import type { Player, StatLine } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { inspectFixture } from '../src/fixtures/inspect';
import { only } from './json';

describe('inspectFixture', () => {
  it('maps nhl boxscore 2025020760 (Merzlikins saved 30)', async () => {
    const result = (await inspectFixture('nhl', 'boxscore', '2025020760')) as {
      lines: StatLine[];
    };
    const line = only(result.lines, (l) => l.playerPublicId === 'nhl-8478007', 'line nhl-8478007');
    expect(line.stats).toMatchObject({ saves: 30 });
  });

  it('passes the roster fixture id as teamExternalId (nhl roster FLA)', async () => {
    const result = (await inspectFixture('nhl', 'roster', 'FLA')) as { players: Player[] };
    const vilmanis = only(result.players, (p) => p.lastName === 'Vilmanis', 'Vilmanis');
    expect(vilmanis.currentTeamExternalId).toBe('FLA');
  });

  it('rejects an endpoint without a mapper, listing the valid ones', async () => {
    await expect(inspectFixture('nhl', 'right-rail', '2025020760')).rejects.toThrow(
      'unknown endpoint "right-rail" for nhl; valid: score, schedule, boxscore, roster, player-landing, skater-summary-reg, goalie-summary-reg',
    );
  });

  it('says espn-nba arrives in S05', async () => {
    await expect(inspectFixture('espn-nba', 'scoreboard', 'x')).rejects.toThrow(/S05/);
  });
});
