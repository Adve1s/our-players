import type { Prefs } from '@our-players/shared';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type DbHandle, openPglite } from '../src/db/client';
import { upsertGames, upsertStatLines } from '../src/db/games';
import { upsertPlayers } from '../src/db/players';
import { upsertTeams } from '../src/db/teams';
import {
  type DayGame,
  type DayLine,
  type DayPlayer,
  type DayRow,
  type DayTeam,
  gameDayRows,
} from '../src/game-day-rows';
import { resultsJob } from '../src/jobs/results';
import { rosterJob } from '../src/jobs/roster';
import { createLogger, type JobContext, runJob } from '../src/jobs/runner';
import { formatRecap, loadRecap } from '../src/recap';
import { espnUrls } from '../src/sources/espn-nba';
import { nhlUrls } from '../src/sources/nhl';
import { createTestDb } from './db';
import { girgensons, merzlikinsLine, NO_OVERRIDES, nhlGame, nyi } from './db-data';
import { fakeClient } from './fake-client';
import { loadFixture } from './fixtures';

const DATE = '2026-01-17';
const CBJ: DayTeam = { id: 1, abbrev: 'CBJ' };
const PIT: DayTeam = { id: 2, abbrev: 'PIT' };

function game(over: Partial<DayGame> = {}): DayGame {
  return {
    publicId: 'nhl-2025020760',
    league: 'NHL',
    status: 'FINAL',
    seasonType: 'REG',
    gameDate: '2026-01-17',
    startTimeUtc: '2026-01-17T23:00:00.000Z',
    away: CBJ,
    home: PIT,
    awayScore: 4,
    homeScore: 3,
    endedIn: 'SO',
    periodScores: null,
    boxScoreStored: true,
    ...over,
  };
}

const player: DayPlayer = {
  publicId: 'nhl-10',
  league: 'NHL',
  nationality: 'LVA',
  firstName: 'Elvis',
  lastName: 'Merzlikins',
  currentTeamId: CBJ.id,
};

const base = {
  gamePublicId: 'nhl-2025020760',
  playerPublicId: 'nhl-10',
  teamExternalId: '29',
  teamId: CBJ.id,
  dnpReason: null,
  starter: null,
};

function skater(plusMinus: number): DayLine {
  return {
    ...base,
    kind: 'hockey_skater',
    played: true,
    stats: { goals: 1, assists: 1, points: 2, plusMinus, shots: 4, toiSeconds: 1112 },
  };
}
function goalie(decision: 'W' | null): DayLine {
  return {
    ...base,
    kind: 'hockey_goalie',
    played: true,
    stats: {
      saves: 28,
      shotsAgainst: 30,
      goalsAgainst: 2,
      savePct: 0.9333,
      toiSeconds: 3600,
      decision,
    },
  };
}

const lineRow = (line: DayLine): DayRow => ({ player, team: CBJ, kind: 'line', line });
const recapOf = (rows: DayRow[], g: DayGame = game()) =>
  formatRecap(DATE, ['LVA'], [{ game: g, rows }]);

describe('formatRecap', () => {
  it.each([
    [2, '1 G · 1 A · +2 · 4 SOG · 18:32'],
    [0, '1 G · 1 A · 0 · 4 SOG · 18:32'],
    [-1, '1 G · 1 A · -1 · 4 SOG · 18:32'],
  ])('a skater line with plus-minus %i reads %s', (plusMinus, text) => {
    expect(recapOf([lineRow(skater(plusMinus))])).toContain(`CBJ  ${text}`);
  });

  it('a goalie line reads saves/shots, save percentage, goals against and decision', () => {
    expect(recapOf([lineRow(goalie('W'))])).toContain('CBJ  28/30 · .933 · 2 GA · W');
  });

  it('a goalie line without a decision omits it', () => {
    expect(recapOf([lineRow(goalie(null))])).toMatch(/CBJ {2}28\/30 · \.933 · 2 GA$/m);
  });

  it('a basketball line reads points, rebounds, assists, minutes, then shooting', () => {
    const line: DayLine = {
      ...base,
      kind: 'basketball_player',
      played: true,
      stats: {
        minutes: 31,
        points: 22,
        rebounds: 8,
        assists: 3,
        fgMade: 8,
        fgAttempted: 15,
        threeMade: 3,
        threeAttempted: 7,
        ftMade: 3,
        ftAttempted: 3,
        turnovers: 0,
        steals: 0,
        blocks: 0,
        offRebounds: 0,
        defRebounds: 0,
        fouls: 0,
        plusMinus: 0,
      },
    };
    expect(recapOf([lineRow(line)])).toContain(
      'CBJ  22 PTS · 8 REB · 3 AST · 31 MIN · FG 8-15 · 3PT 3-7 · FT 3-3',
    );
  });

  it.each([
    ["COACH'S DECISION", "DNP — Coach's decision"],
    [null, 'DNP'],
  ])('a dnp row with reason %s reads %s', (reason, text) => {
    expect(recapOf([{ player, team: CBJ, kind: 'dnp', reason }])).toMatch(
      new RegExp(`CBJ {2}${text}$`, 'm'),
    );
  });

  it('a not-in-lineup row reads Not in lineup', () => {
    expect(recapOf([{ player, team: CBJ, kind: 'not-in-lineup' }])).toContain(
      'Elvis Merzlikins  CBJ  Not in lineup',
    );
  });

  it.each<[Partial<DayGame>, string]>([
    [{ status: 'SCHEDULED', awayScore: null, homeScore: null, endedIn: null }, 'Not started'],
    [{ status: 'LIVE', endedIn: null }, 'In progress'],
    [{ status: 'FINAL' }, 'Waiting for stats'],
  ])('an upcoming row in a game %o reads %s', (over, text) => {
    const g = game({ boxScoreStored: false, ...over });
    expect(recapOf([{ player, team: CBJ, kind: 'upcoming' }], g)).toContain(
      `Elvis Merzlikins  CBJ  ${text}`,
    );
  });

  it.each<[Partial<DayGame>, string]>([
    [{}, 'CBJ 4 – 3 PIT  Final/SO'],
    [{ endedIn: 'OT' }, 'CBJ 4 – 3 PIT  Final/OT'],
    [{ endedIn: 'REG' }, 'CBJ 4 – 3 PIT  Final'],
    [{ status: 'LIVE', endedIn: null }, 'CBJ 4 – 3 PIT  Live'],
    [
      { status: 'SCHEDULED', awayScore: null, homeScore: null, endedIn: null },
      'CBJ @ PIT  23:00 UTC',
    ],
    [
      { status: 'POSTPONED', awayScore: null, homeScore: null, endedIn: null },
      'CBJ @ PIT  Postponed',
    ],
    [
      { status: 'CANCELLED', awayScore: null, homeScore: null, endedIn: null },
      'CBJ @ PIT  Cancelled',
    ],
  ])('game header for %o reads %s', (over, header) => {
    const text = recapOf([lineRow(skater(0))], game(over));
    expect(text.split('\n')).toContain(header);
  });

  it("a league heading precedes that league's games", () => {
    const lines = recapOf([lineRow(skater(0))]).split('\n');
    expect(lines[0]).toBe('NHL 2026-01-17');
    expect(lines[1]).toBe('CBJ 4 – 3 PIT  Final/SO');
  });

  it('no groups reads no players from the countries on that date', () => {
    expect(formatRecap(DATE, ['LVA'], [])).toBe('No players from LVA on 2026-01-17.');
    expect(formatRecap(DATE, ['LVA', 'EST'], [])).toBe('No players from LVA, EST on 2026-01-17.');
  });
});

// --- loadRecap over the real ingestion code ---

const GAME = '2025020760';
const ROSTER_DAY = '2026-10-18';
const TEAMS = ['CBJ', 'FLA', 'PIT'];

function calendar(): unknown {
  const raw = loadFixture('nhl', 'schedule-calendar', ROSTER_DAY) as {
    teams: { abbrev: string }[];
  };
  raw.teams = raw.teams.filter((t) => TEAMS.includes(t.abbrev));
  return raw;
}

function score(): unknown {
  const raw = loadFixture('nhl', 'score', DATE) as { games: { id: number }[] };
  raw.games = raw.games.filter((g) => String(g.id) === GAME);
  return raw;
}

const routes = (): Record<string, unknown> => ({
  [nhlUrls.scheduleCalendar(ROSTER_DAY)]: calendar(),
  ...Object.fromEntries(TEAMS.map((t) => [nhlUrls.roster(t), loadFixture('nhl', 'roster', t)])),
  [nhlUrls.score(DATE)]: score(),
  [nhlUrls.boxscore(GAME)]: loadFixture('nhl', 'boxscore', GAME),
  [nhlUrls.playerLanding('8476878')]: loadFixture('nhl', 'player-landing', '8476878'),
  [nhlUrls.playerLanding('8478007')]: loadFixture('nhl', 'player-landing', '8478007'),
});

const lva: Prefs = {
  leagues: new Set(['NHL', 'NBA']),
  countries: new Set(['LVA']),
  favorites: new Set(),
  hidden: new Set(),
};

let handle: DbHandle;

beforeAll(async () => (await createTestDb()).close(), 30_000);

beforeEach(async () => {
  handle = await createTestDb();
  const ctx: JobContext = {
    db: handle.db,
    client: fakeClient(routes()),
    now: () => new Date(`${ROSTER_DAY}T12:00:00Z`),
    log: createLogger(() => {}),
    overrides: NO_OVERRIDES,
  };
  await runJob(ctx, 'roster', rosterJob, { league: 'NHL' });
  await runJob(ctx, 'results', resultsJob, { league: 'NHL', date: DATE });
  // A healthy scratch: on CBJ's roster, not in the box score.
  await upsertPlayers(handle.db, [{ ...girgensons, currentTeamExternalId: '29' }], NO_OVERRIDES);
});

afterEach(() => handle.close());

describe('loadRecap', () => {
  it("the day's recap shows the game, both LVA goalies' lines and Girgensons not in lineup", async () => {
    const text = formatRecap(DATE, ['LVA'], gameDayRows(await loadRecap(handle.db, DATE), lva));

    expect(text).toBe(
      [
        'NHL 2026-01-17',
        'CBJ 4 – 3 PIT  Final/SO',
        '  Elvis Merzlikins   CBJ  30/33 · .909 · 3 GA · W',
        '  Zemgus Girgensons  CBJ  Not in lineup',
        '  Arturs Silovs      PIT  23/26 · .885 · 3 GA · OTL',
      ].join('\n'),
    );
  });

  it('a day with NHL and NBA games shows a block per league, with Porziņģis in the NBA one', async () => {
    const DAY = '2026-03-16';
    // An NHL game on the NBA fixtures' date: Merzlikins (CBJ, stored by the roster run) in net.
    await upsertTeams(handle.db, [nyi]);
    await upsertGames(handle.db, [
      { ...nhlGame, gameDate: DAY, startTimeUtc: '2026-03-16T23:00:00.000Z' },
    ]);
    await upsertStatLines(handle.db, nhlGame.publicId, [merzlikinsLine]);
    const ctx: JobContext = {
      db: handle.db,
      client: fakeClient({
        [espnUrls.scoreboard(DAY)]: loadFixture('espn-nba', 'scoreboard', DAY),
        [espnUrls.summary('401810839')]: loadFixture('espn-nba', 'summary', '401810839'),
        [espnUrls.athlete('3102531')]: loadFixture('espn-nba', 'athlete', '3102531'),
      }),
      now: () => new Date(`${ROSTER_DAY}T12:00:00Z`),
      log: createLogger(() => {}),
      overrides: NO_OVERRIDES,
    };
    await runJob(ctx, 'results', resultsJob, { league: 'NBA', date: DAY });

    const text = formatRecap(DAY, ['LVA'], gameDayRows(await loadRecap(handle.db, DAY), lva));

    const lines = text.split('\n');
    expect(lines).toContain('NHL 2026-03-16');
    expect(lines).toContain('NBA 2026-03-16');
    expect(text).toContain(
      'Kristaps Porzingis  GS  30 PTS · 5 REB · 4 AST · 26 MIN · FG 8-13 · 3PT 1-5 · FT 13-14',
    );
  });

  // A fresh PGlite boots cold, slowly under a full parallel run.
  it('a database that was never migrated says to run a job first', async () => {
    const fresh = openPglite();
    try {
      await expect(loadRecap(fresh.db, DATE)).rejects.toThrow(
        'the database has no tables yet: run `pnpm job` (any job migrates it) first',
      );
    } finally {
      await fresh.close();
    }
  }, 30_000);
});
