import type { Game } from '@our-players/shared';
import { describe, expect, it } from 'vitest';
import { mapScoreboard } from '../src/sources/espn-nba/games';
import { loadFixture } from './fixtures';
import { list, obj, only } from './json';

const scoreboard = (date: string) => loadFixture('espn-nba', 'scoreboard', date);

function game(games: Game[], externalId: string): Game {
  return only(games, (g) => g.externalId === externalId, `game ${externalId}`);
}

// The raw event inside a scoreboard response, for mutating a copy.
function rawEvent(raw: unknown, id: string) {
  return only(list(raw, 'events'), (e) => e.id === id, `raw event ${id}`);
}

function rawCompetitor(event: unknown, homeAway: 'home' | 'away') {
  return only(
    list(event, 'competitions', 0, 'competitors'),
    (c) => c.homeAway === homeAway,
    `${homeAway} competitor`,
  );
}

describe('mapScoreboard: overtime game 401810899 GS@DAL (scoreboard/2026-03-23)', () => {
  const ot = () => game(mapScoreboard(scoreboard('2026-03-23'), '2026-03-23').games, '401810899');

  it('derives the public ID from the ESPN event ID', () => {
    const g = ot();
    expect(g.publicId).toBe('nba-401810899');
    expect(g.league).toBe('NBA');
    expect(g.source).toBe('espn');
  });

  it('takes gameDate from the requested day although the UTC start is the next day', () => {
    expect(ot().gameDate).toBe('2026-03-23');
  });

  it('keeps the start time as ESPN gives it ("2026-03-24T01:30Z")', () => {
    expect(ot().startTimeUtc).toBe('2026-03-24T01:30Z');
  });

  it('labels season year 2026 as "2025-26"', () => {
    expect(ot().season).toBe('2025-26');
  });

  it('maps season type 2 to REG', () => {
    expect(ot().seasonType).toBe('REG');
  });

  it('maps STATUS_FINAL to FINAL', () => {
    expect(ot().status).toBe('FINAL');
  });

  it('references the teams by ESPN team ID (GS 9 away, DAL 6 home)', () => {
    expect(ot().awayTeamExternalId).toBe('9');
    expect(ot().homeTeamExternalId).toBe('6');
  });

  it('parses the string scores: away 137, home 131', () => {
    expect(ot().awayScore).toBe(137);
    expect(ot().homeScore).toBe(131);
  });

  it('gives one period score per linescore, labelled Q1-Q4 then OT', () => {
    // DAL linescores 31,42,25,28,5; GS 34,29,35,28,11.
    expect(ot().periodScores).toEqual([
      { period: 'Q1', away: 34, home: 31 },
      { period: 'Q2', away: 29, home: 42 },
      { period: 'Q3', away: 35, home: 25 },
      { period: 'Q4', away: 28, home: 28 },
      { period: 'OT', away: 11, home: 5 },
    ]);
  });

  it('maps five periods to endedIn OT', () => {
    expect(ot().endedIn).toBe('OT');
  });
});

describe('mapScoreboard: regulation game 401810839 GS@WSH (scoreboard/2026-03-16)', () => {
  const reg = () => game(mapScoreboard(scoreboard('2026-03-16'), '2026-03-16').games, '401810839');

  it('maps four periods to endedIn REG', () => {
    expect(reg().endedIn).toBe('REG');
  });

  it('labels the four periods Q1-Q4 with GS 34,30,34,27 and WSH 23,34,29,31', () => {
    expect(reg().periodScores).toEqual([
      { period: 'Q1', away: 34, home: 23 },
      { period: 'Q2', away: 30, home: 34 },
      { period: 'Q3', away: 34, home: 29 },
      { period: 'Q4', away: 27, home: 31 },
    ]);
  });

  it('takes the final score GS 125, WSH 117', () => {
    expect(reg().awayScore).toBe(125);
    expect(reg().homeScore).toBe(117);
    expect(reg().awayTeamExternalId).toBe('9');
    expect(reg().homeTeamExternalId).toBe('27');
  });

  it('takes gameDate and start time ("2026-03-16T23:00Z")', () => {
    expect(reg().gameDate).toBe('2026-03-16');
    expect(reg().startTimeUtc).toBe('2026-03-16T23:00Z');
  });
});

describe('mapScoreboard: preseason (scoreboard/2026-10-10)', () => {
  const result = () => mapScoreboard(scoreboard('2026-10-10'), '2026-10-10');
  const wshDet = () => game(result().games, '401906510');

  it('maps season type 1 to PRE (401906510 DET@WSH)', () => {
    expect(wshDet().seasonType).toBe('PRE');
  });

  it('labels season year 2027 as "2026-27"', () => {
    expect(wshDet().season).toBe('2026-27');
  });

  it('maps the Final/OT preseason game to endedIn OT', () => {
    expect(wshDet().endedIn).toBe('OT');
  });

  it('takes the final score DET 108, WSH 114', () => {
    expect(wshDet().awayScore).toBe(108);
    expect(wshDet().homeScore).toBe(114);
    expect(wshDet().awayTeamExternalId).toBe('8');
    expect(wshDet().homeTeamExternalId).toBe('27');
  });

  it('gives the overtime period scores (WSH 40,16,24,18,16; DET 20,30,28,20,10)', () => {
    expect(wshDet().periodScores).toEqual([
      { period: 'Q1', away: 20, home: 40 },
      { period: 'Q2', away: 30, home: 16 },
      { period: 'Q3', away: 28, home: 24 },
      { period: 'Q4', away: 20, home: 18 },
      { period: 'OT', away: 10, home: 16 },
    ]);
  });

  it('maps all 7 games of the day, every one PRE', () => {
    const { games } = result();
    expect(games).toHaveLength(7);
    expect(games.every((g) => g.seasonType === 'PRE')).toBe(true);
  });
});

describe('mapScoreboard: other recorded days', () => {
  it('scoreboard/2026-04-13 has no games, no teams and no warnings', () => {
    const result = mapScoreboard(scoreboard('2026-04-13'), '2026-04-13');
    expect(result.games).toEqual([]);
    expect(result.teams).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['2026-03-14', 7],
    ['2026-03-16', 8],
    ['2026-03-23', 10],
    ['2026-03-24', 4],
  ])('scoreboard/%s maps %i games, every one FINAL and REG', (date, count) => {
    const { games } = mapScoreboard(scoreboard(date), date);
    expect(games).toHaveLength(count);
    expect(games.every((g) => g.status === 'FINAL' && g.seasonType === 'REG')).toBe(true);
  });

  it('scoreboard/2026-03-14: BKN@PHI 401810824 ended in regulation 97-104', () => {
    const g = game(mapScoreboard(scoreboard('2026-03-14'), '2026-03-14').games, '401810824');
    expect(g.awayTeamExternalId).toBe('17');
    expect(g.homeTeamExternalId).toBe('20');
    expect(g.awayScore).toBe(97);
    expect(g.homeScore).toBe(104);
    expect(g.endedIn).toBe('REG');
    expect(g.startTimeUtc).toBe('2026-03-14T17:00Z');
  });

  it('scoreboard/2026-03-14: DEN@LAL 401810829 ended in overtime 125-127', () => {
    const g = game(mapScoreboard(scoreboard('2026-03-14'), '2026-03-14').games, '401810829');
    expect(g.awayScore).toBe(125);
    expect(g.homeScore).toBe(127);
    expect(g.endedIn).toBe('OT');
    expect(g.periodScores?.at(-1)).toEqual({ period: 'OT', away: 7, home: 9 });
  });

  it('scoreboard/2026-03-24: DEN@PHX 401810905 keeps the schedule date 2026-03-24 with a UTC start on the 25th', () => {
    const g = game(mapScoreboard(scoreboard('2026-03-24'), '2026-03-24').games, '401810905');
    expect(g.gameDate).toBe('2026-03-24');
    expect(g.startTimeUtc).toBe('2026-03-25T03:00Z');
    expect(g.awayTeamExternalId).toBe('7');
    expect(g.homeTeamExternalId).toBe('21');
    expect(g.awayScore).toBe(125);
    expect(g.homeScore).toBe(123);
    expect(g.endedIn).toBe('REG');
  });

  it('returns no warnings for a day it maps fully', () => {
    expect(mapScoreboard(scoreboard('2026-03-23'), '2026-03-23').warnings).toEqual([]);
  });
});

describe('mapScoreboard: teams', () => {
  it('names team 9 by its short name "Warriors"', () => {
    const team = only(
      mapScoreboard(scoreboard('2026-03-23'), '2026-03-23').teams,
      (t) => t.externalId === '9',
      'team 9',
    );
    expect(team.name).toBe('Warriors');
    expect(team.abbrev).toBe('GS');
    expect(team.league).toBe('NBA');
    expect(team.source).toBe('espn');
  });

  it('lists each of the 20 teams of 10 games once', () => {
    const { teams } = mapScoreboard(scoreboard('2026-03-23'), '2026-03-23');
    expect(teams).toHaveLength(20);
    expect(new Set(teams.map((t) => t.externalId)).size).toBe(20);
  });

  it('dedupes teams by externalId when a team appears in two events', () => {
    const raw = scoreboard('2026-03-23');
    const copy = structuredClone(rawEvent(raw, '401810899'));
    copy.id = '401810999';
    list(raw, 'events').push(copy);
    const { games, teams } = mapScoreboard(raw, '2026-03-23');
    expect(games).toHaveLength(11);
    expect(teams).toHaveLength(20);
  });
});

describe('mapScoreboard: statuses no fixture contains (mutated copies of 401810839)', () => {
  const withStatus = (name: string) => {
    const raw = scoreboard('2026-03-16');
    obj(rawEvent(raw, '401810839'), 'status', 'type').name = name;
    return game(mapScoreboard(raw, '2026-03-16').games, '401810839');
  };

  it.each([
    ['STATUS_SCHEDULED', 'SCHEDULED'],
    ['STATUS_IN_PROGRESS', 'LIVE'],
    ['STATUS_HALFTIME', 'LIVE'],
    ['STATUS_END_PERIOD', 'LIVE'],
    ['STATUS_FINAL', 'FINAL'],
    ['STATUS_POSTPONED', 'POSTPONED'],
    ['STATUS_CANCELED', 'CANCELLED'],
  ])('maps %s to %s', (name, status) => {
    expect(withStatus(name).status).toBe(status);
  });

  it.each(['STATUS_SCHEDULED', 'STATUS_POSTPONED', 'STATUS_CANCELED'])(
    'gives a %s game null scores, periodScores and endedIn',
    (name) => {
      const g = withStatus(name);
      expect(g.awayScore).toBeNull();
      expect(g.homeScore).toBeNull();
      expect(g.periodScores).toBeNull();
      expect(g.endedIn).toBeNull();
    },
  );

  it.each(['STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_END_PERIOD'])(
    'gives a %s game its scores and period scores but endedIn null',
    (name) => {
      const g = withStatus(name);
      expect(g.awayScore).toBe(125);
      expect(g.homeScore).toBe(117);
      expect(g.periodScores?.map((p) => p.period)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
      expect(g.endedIn).toBeNull();
    },
  );

  it('gives a scheduled game with score "0" and no linescores null scores and periodScores', () => {
    const raw = scoreboard('2026-03-16');
    const event = rawEvent(raw, '401810839');
    obj(event, 'status', 'type').name = 'STATUS_SCHEDULED';
    for (const side of ['home', 'away'] as const) {
      const competitor = rawCompetitor(event, side);
      competitor.score = '0';
      delete competitor.linescores;
    }
    const g = game(mapScoreboard(raw, '2026-03-16').games, '401810839');
    expect(g.status).toBe('SCHEDULED');
    expect(g.awayScore).toBeNull();
    expect(g.homeScore).toBeNull();
    expect(g.periodScores).toBeNull();
  });
});

describe('mapScoreboard: season types and overtimes no fixture contains (mutated copies)', () => {
  it.each([
    [1, 'PRE'],
    [2, 'REG'],
    [3, 'POST'],
  ])('maps season type %i to %s', (type, seasonType) => {
    const raw = scoreboard('2026-03-16');
    obj(rawEvent(raw, '401810839'), 'season').type = type;
    expect(game(mapScoreboard(raw, '2026-03-16').games, '401810839').seasonType).toBe(seasonType);
  });

  it('labels a sixth period 2OT and maps the game to endedIn OT', () => {
    const raw = scoreboard('2026-03-23');
    const event = rawEvent(raw, '401810899');
    list(rawCompetitor(event, 'home'), 'linescores').push({
      value: 0,
      displayValue: '0',
      period: 6,
    });
    list(rawCompetitor(event, 'away'), 'linescores').push({
      value: 2,
      displayValue: '2',
      period: 6,
    });
    const g = game(mapScoreboard(raw, '2026-03-23').games, '401810899');
    expect(g.periodScores?.map((p) => p.period)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'OT', '2OT']);
    expect(g.periodScores?.at(-1)).toEqual({ period: '2OT', away: 2, home: 0 });
    expect(g.endedIn).toBe('OT');
  });
});

describe('mapScoreboard: games it skips with a warning', () => {
  it('skips a game with an unknown status and keeps the others', () => {
    const raw = scoreboard('2026-03-16');
    obj(rawEvent(raw, '401810839'), 'status', 'type').name = 'STATUS_X';
    const { games } = mapScoreboard(raw, '2026-03-16');
    expect(games.map((g) => g.externalId)).not.toContain('401810839');
    expect(games).toHaveLength(7);
  });

  it('warns once about an unknown status, naming endpoint, event and value', () => {
    const raw = scoreboard('2026-03-16');
    obj(rawEvent(raw, '401810839'), 'status', 'type').name = 'STATUS_X';
    const { warnings } = mapScoreboard(raw, '2026-03-16');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('espn-nba scoreboard');
    expect(warnings[0]).toContain('401810839');
    expect(warnings[0]).toContain('"STATUS_X"');
  });

  it('skips a game with season type 5 and keeps the others', () => {
    const raw = scoreboard('2026-03-16');
    obj(rawEvent(raw, '401810839'), 'season').type = 5;
    const { games } = mapScoreboard(raw, '2026-03-16');
    expect(games.map((g) => g.externalId)).not.toContain('401810839');
    expect(games).toHaveLength(7);
  });

  it('warns once about season type 5, naming endpoint, event and value', () => {
    const raw = scoreboard('2026-03-16');
    obj(rawEvent(raw, '401810839'), 'season').type = 5;
    const { warnings } = mapScoreboard(raw, '2026-03-16');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('espn-nba scoreboard');
    expect(warnings[0]).toContain('401810839');
    expect(warnings[0]).toMatch(/\b5\b/);
  });
});

describe('mapScoreboard: malformed payloads throw naming source and endpoint', () => {
  it.each([
    [
      'an event without id',
      (raw: unknown) => {
        delete rawEvent(raw, '401810839').id;
      },
    ],
    [
      'a score as a number',
      (raw: unknown) => {
        rawCompetitor(rawEvent(raw, '401810839'), 'home').score = 117;
      },
    ],
    [
      'missing events',
      (raw: unknown) => {
        delete obj(raw).events;
      },
    ],
  ])('throws "espn-nba scoreboard: invalid payload" on %s', (_what, mutate) => {
    const raw = scoreboard('2026-03-16');
    mutate(raw);
    expect(() => mapScoreboard(raw, '2026-03-16')).toThrow(/^espn-nba scoreboard: invalid payload/);
  });
});
