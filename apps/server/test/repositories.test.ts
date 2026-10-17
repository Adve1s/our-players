import type { Source, StatKind, StatLine } from '@our-players/shared';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Db, DbHandle } from '../src/db/client';
import { upsertGames, upsertStatLines } from '../src/db/games';
import { finishJobRun, startJobRun } from '../src/db/job-runs';
import { searchName, upsertPlayers } from '../src/db/players';
import {
  games,
  jobRuns,
  playerExternalIds,
  players,
  seasonStats,
  statLines,
  teams,
} from '../src/db/schema';
import { upsertSeasonStats } from '../src/db/season-stats';
import { upsertTeams } from '../src/db/teams';
import { createTestDb } from './db';
import {
  bertansDnpLine,
  bos,
  cbj,
  celtics,
  embiid,
  embiidLine,
  freeAgent,
  girgensons,
  girgensonsLine,
  goalieStats,
  type LeagueSlice,
  merzlikinsLine,
  NO_OVERRIDES,
  nba,
  nbaGame,
  nhl,
  nhlGame,
  nhlSeasonStats,
  nyi,
  override,
  overrides,
  porzingis,
  porzingisLine,
  porzingisStats,
  sixers,
  skaterStats,
} from './db-data';

// The Date read back has millisecond resolution, so a later write needs a strictly later clock.
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

// Teams, players, game, lines, season stats: the order references need.
async function writeSlice(db: Db, slice: LeagueSlice): Promise<number[]> {
  return [
    await upsertTeams(db, slice.teams),
    await upsertPlayers(db, slice.players, NO_OVERRIDES),
    await upsertGames(db, [slice.game]),
    await upsertStatLines(db, slice.game.publicId, slice.lines),
    await upsertSeasonStats(db, slice.seasonStats),
  ];
}

// Everything but the lines, for tests that write lines themselves.
async function writeSliceWithoutLines(db: Db, slice: LeagueSlice): Promise<void> {
  await upsertTeams(db, slice.teams);
  await upsertPlayers(db, slice.players, NO_OVERRIDES);
  await upsertGames(db, [slice.game]);
}

async function allRows(db: Db) {
  return {
    teams: await db.select().from(teams).orderBy(teams.id),
    players: await db.select().from(players).orderBy(players.id),
    playerExternalIds: await db
      .select()
      .from(playerExternalIds)
      .orderBy(playerExternalIds.externalId),
    games: await db.select().from(games).orderBy(games.id),
    statLines: await db.select().from(statLines).orderBy(statLines.gameId, statLines.playerId),
    seasonStats: await db.select().from(seasonStats).orderBy(seasonStats.playerId),
  };
}

async function linesOf(db: Db, gamePublicId: string) {
  const [game] = await db.select().from(games).where(eq(games.publicId, gamePublicId));
  if (!game) throw new Error(`test setup: game ${gamePublicId} not stored`);
  return db
    .select()
    .from(statLines)
    .where(eq(statLines.gameId, game.id))
    .orderBy(statLines.playerId);
}

async function teamRowId(db: Db, source: Source, externalId: string): Promise<number> {
  const [row] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.source, source), eq(teams.externalId, externalId)));
  if (!row) throw new Error(`test setup: team ${source}/${externalId} not stored`);
  return row.id;
}

// Both leagues' teams go in first, so every lookup below sees NYI and the Celtics sharing ID '2'.
async function writeBothSlices(db: Db): Promise<void> {
  await upsertTeams(db, [...nhl.teams, ...nba.teams]);
  await writeSlice(db, nhl);
  await writeSlice(db, nba);
}

async function playerRow(db: Db, publicId: string) {
  const [row] = await db.select().from(players).where(eq(players.publicId, publicId));
  if (!row) throw new Error(`test setup: player ${publicId} not stored`);
  return row;
}

async function lineOf(db: Db, gamePublicId: string, playerPublicId: string) {
  const player = await playerRow(db, playerPublicId);
  const line = (await linesOf(db, gamePublicId)).find((l) => l.playerId === player.id);
  if (!line) throw new Error(`test setup: no line for ${playerPublicId}`);
  return line;
}

// Builds a line the compiler would reject, to test the runtime check behind it.
const malformed = (line: StatLine, patch: Record<string, unknown>): StatLine =>
  ({ ...line, ...patch }) as unknown as StatLine;

const withoutKey = (stats: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(stats).filter(([k]) => k !== key));

describe('repositories', () => {
  // The first createTestDb() migrates this file's template (~3 s, longer under parallel load).
  beforeAll(async () => (await createTestDb()).close(), 30_000);
  let handle: DbHandle | undefined;
  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });
  async function open(): Promise<Db> {
    handle = await createTestDb();
    return handle.db;
  }

  describe('searchName', () => {
    it.each([
      ['Kristaps Porziņģis', 'kristaps porzingis'],
      ['Elvis Merzļikins', 'elvis merzlikins'],
      ['Kārlis Čukste', 'karlis cukste'],
      ['Nikola Jokić', 'nikola jokic'],
      ['Joel Embiid', 'joel embiid'],
      // shortcut in the spec: letters that don't decompose stay as they are.
      ['Jonas Røndbjerg', 'jonas røndbjerg'],
    ])('%s → %s', (name, expected) => expect(searchName(name)).toBe(expected));
  });

  describe('idempotent writes (AC 2)', () => {
    it.each([
      ['NHL', nhl, { players: 3, lines: 2 }],
      ['NBA', nba, { players: 3, lines: 3 }],
    ])(
      'writing the same %s slice twice leaves every row identical, updated_at included',
      async (_league, slice, expected) => {
        const db = await open();
        await writeSlice(db, slice);
        const first = await allRows(db);
        expect(first.teams).toHaveLength(2);
        expect(first.players).toHaveLength(expected.players);
        expect(first.playerExternalIds).toHaveLength(expected.players);
        expect(first.games).toHaveLength(1);
        expect(first.statLines).toHaveLength(expected.lines);
        expect(first.seasonStats).toHaveLength(1);
        await tick();
        await writeSlice(db, slice);
        expect(await allRows(db)).toEqual(first);
      },
    );

    it.each([
      ['NHL', nhl],
      ['NBA', nba],
    ])(
      'the second write of the same %s slice returns 0 from every call',
      async (_league, slice) => {
        const db = await open();
        await writeSlice(db, slice);
        expect(await writeSlice(db, slice)).toEqual([0, 0, 0, 0, 0]);
      },
    );
  });

  describe('changes update in place (AC 2)', () => {
    it('a changed score updates the one game row with a later updated_at', async () => {
      const db = await open();
      await writeSlice(db, nhl);
      const [before] = await db.select().from(games);
      await tick();
      expect(await upsertGames(db, [{ ...nhlGame, homeScore: 4, awayScore: 2 }])).toBe(1);
      const rows = await db.select().from(games);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(before?.id);
      expect(rows[0]?.homeScore).toBe(4);
      expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
    });

    it('a changed stat line updates that one row with a later updated_at', async () => {
      const db = await open();
      await writeSlice(db, nhl);
      const before = await lineOf(db, nhlGame.publicId, girgensons.publicId);
      await tick();
      const changed = { ...girgensonsLine, stats: { ...skaterStats, goals: 2, points: 3 } };
      expect(await upsertStatLines(db, nhlGame.publicId, [changed, merzlikinsLine])).toBe(1);
      expect(await linesOf(db, nhlGame.publicId)).toHaveLength(2);
      const after = await lineOf(db, nhlGame.publicId, girgensons.publicId);
      expect(after.stats).toEqual({ ...skaterStats, goals: 2, points: 3 });
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });

    it('a changed season-stats row updates in place with a later fetched_at', async () => {
      const db = await open();
      await writeSlice(db, nhl);
      const [before] = await db.select().from(seasonStats);
      await tick();
      const stats = { gamesPlayed: 2, goals: 1, assists: 2, points: 3 };
      expect(await upsertSeasonStats(db, [{ ...nhlSeasonStats, stats }])).toBe(1);
      const rows = await db.select().from(seasonStats);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.stats).toEqual(stats);
      expect(rows[0]?.fetchedAt.getTime()).toBeGreaterThan(before?.fetchedAt.getTime() ?? 0);
    });
  });

  describe("a game's lines are written as one set", () => {
    it("re-writing a game's lines without one player deletes that player's line", async () => {
      const db = await open();
      await writeSlice(db, nba);
      const count = await upsertStatLines(db, nbaGame.publicId, [porzingisLine, bertansDnpLine]);
      expect(count).toBeGreaterThanOrEqual(1);
      const embiidId = (await playerRow(db, embiid.publicId)).id;
      const remaining = await linesOf(db, nbaGame.publicId);
      expect(remaining).toHaveLength(2);
      expect(remaining.map((l) => l.playerId)).not.toContain(embiidId);
    });

    it("re-writing one game's lines leaves the other game's lines untouched", async () => {
      const db = await open();
      await writeSlice(db, nhl);
      await writeSlice(db, nba);
      const nhlBefore = await linesOf(db, nhlGame.publicId);
      expect(nhlBefore).toHaveLength(2);
      await tick();
      await upsertStatLines(db, nbaGame.publicId, [porzingisLine]);
      expect(await linesOf(db, nhlGame.publicId)).toEqual(nhlBefore);
    });

    it('an invalid batch that drops a player leaves the stored lines unchanged', async () => {
      const db = await open();
      await writeSlice(db, nba);
      const before = await linesOf(db, nbaGame.publicId);
      expect(before).toHaveLength(3);
      await tick();
      // Drops Bertāns and carries one invalid line: validation must come before the delete.
      const bad = malformed(embiidLine, { stats: { ...embiidLine.stats, points: -1 } });
      await expect(upsertStatLines(db, nbaGame.publicId, [porzingisLine, bad])).rejects.toThrow(
        /stat line nba-401810001\/nba-3059318[\s\S]*invalid basketball_player stats:/,
      );
      expect(await linesOf(db, nbaGame.publicId)).toEqual(before);
    });

    it("an empty set deletes all of that game's lines", async () => {
      const db = await open();
      await writeSlice(db, nba);
      expect(await upsertStatLines(db, nbaGame.publicId, [])).toBeGreaterThanOrEqual(1);
      expect(await linesOf(db, nbaGame.publicId)).toEqual([]);
    });
  });

  describe('invalid stat payloads are rejected (AC 3)', () => {
    type Case = [StatKind, string, LeagueSlice, StatLine, StatLine];
    const cases: Case[] = [
      [
        'hockey_skater',
        'a missing field',
        nhl,
        malformed(girgensonsLine, { stats: withoutKey(skaterStats, 'shots') }),
        merzlikinsLine,
      ],
      [
        'hockey_skater',
        'a negative count',
        nhl,
        malformed(girgensonsLine, { stats: { ...skaterStats, goals: -1 } }),
        merzlikinsLine,
      ],
      [
        'hockey_skater',
        'an unknown key',
        nhl,
        malformed(girgensonsLine, { stats: { ...skaterStats, faceoffWins: 3 } }),
        merzlikinsLine,
      ],
      [
        'hockey_goalie',
        'a missing field',
        nhl,
        malformed(merzlikinsLine, { stats: withoutKey(goalieStats, 'saves') }),
        girgensonsLine,
      ],
      [
        'hockey_goalie',
        'a negative count',
        nhl,
        malformed(merzlikinsLine, { stats: { ...goalieStats, saves: -1 } }),
        girgensonsLine,
      ],
      [
        'hockey_goalie',
        'an unknown key',
        nhl,
        malformed(merzlikinsLine, { stats: { ...goalieStats, shutouts: 1 } }),
        girgensonsLine,
      ],
      [
        'basketball_player',
        'a missing field',
        nba,
        malformed(porzingisLine, { stats: withoutKey(porzingisStats, 'rebounds') }),
        embiidLine,
      ],
      [
        'basketball_player',
        'a negative count',
        nba,
        malformed(porzingisLine, { stats: { ...porzingisStats, points: -1 } }),
        embiidLine,
      ],
      [
        'basketball_player',
        'an unknown key',
        nba,
        malformed(porzingisLine, { stats: { ...porzingisStats, dunks: 2 } }),
        embiidLine,
      ],
    ];

    it.each(cases)(
      '%s with %s is rejected naming the game, player and kind',
      async (kind, _fault, slice, bad, valid) => {
        const db = await open();
        await writeSliceWithoutLines(db, slice);
        await expect(upsertStatLines(db, slice.game.publicId, [valid, bad])).rejects.toThrow(
          new RegExp(
            `stat line ${bad.gamePublicId}/${bad.playerPublicId}[\\s\\S]*invalid ${kind} stats:`,
          ),
        );
      },
    );

    it.each(cases)(
      '%s with %s stores no line of the batch, the valid one included',
      async (_kind, _fault, slice, bad, valid) => {
        const db = await open();
        await writeSliceWithoutLines(db, slice);
        await upsertStatLines(db, slice.game.publicId, [valid, bad]).catch(() => undefined);
        expect(await db.select().from(statLines)).toEqual([]);
      },
    );

    it('a non-played line with stats is rejected naming the line', async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      const line = malformed(girgensonsLine, { played: false, dnpReason: 'SCRATCH' });
      await expect(upsertStatLines(db, nhlGame.publicId, [line])).rejects.toThrow(
        /stat line nhl-2026020001\/nhl-8476878/,
      );
    });

    it('a played line without stats is rejected naming the line', async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      const line = malformed(girgensonsLine, { stats: null });
      await expect(upsertStatLines(db, nhlGame.publicId, [line])).rejects.toThrow(
        /stat line nhl-2026020001\/nhl-8476878/,
      );
    });

    it('a hockey_skater line on the NBA game is rejected naming the line', async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nba);
      const line = malformed(porzingisLine, { kind: 'hockey_skater', stats: skaterStats });
      await expect(upsertStatLines(db, nbaGame.publicId, [line])).rejects.toThrow(
        /stat line nba-401810001\/nba-3102531/,
      );
    });

    it("a line whose team isn't the home or away team is rejected naming the line", async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      await upsertTeams(db, [bos]);
      const line = { ...girgensonsLine, teamExternalId: bos.externalId };
      await expect(upsertStatLines(db, nhlGame.publicId, [line])).rejects.toThrow(
        /stat line nhl-2026020001\/nhl-8476878/,
      );
    });

    it('a line whose gamePublicId differs from the argument is rejected naming the line', async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      const line = { ...girgensonsLine, gamePublicId: 'nhl-2026020002' };
      // Either game ID may head the message; the player must be named.
      await expect(upsertStatLines(db, nhlGame.publicId, [line])).rejects.toThrow(
        /stat line nhl-202602000[12]\/nhl-8476878/,
      );
    });
  });

  describe('unknown references throw naming the ID', () => {
    it("a player's unknown team", async () => {
      const db = await open();
      await upsertTeams(db, nhl.teams);
      const player = { ...girgensons, currentTeamExternalId: '22' };
      await expect(upsertPlayers(db, [player], NO_OVERRIDES)).rejects.toThrow(
        /unknown team nhl\/22/,
      );
    });

    it("a game's unknown team", async () => {
      const db = await open();
      await upsertTeams(db, nba.teams);
      const game = { ...nbaGame, awayTeamExternalId: '5' };
      await expect(upsertGames(db, [game])).rejects.toThrow(/unknown team espn\/5/);
    });

    it("a line's unknown player", async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      const line = { ...girgensonsLine, playerPublicId: 'nhl-8400001' };
      await expect(upsertStatLines(db, nhlGame.publicId, [line])).rejects.toThrow(
        /unknown player nhl-8400001/,
      );
    });

    it('lines for an unknown game', async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      const line = { ...girgensonsLine, gamePublicId: 'nhl-2026020999' };
      await expect(upsertStatLines(db, 'nhl-2026020999', [line])).rejects.toThrow(
        /unknown game nhl-2026020999/,
      );
    });

    it('season stats for an unknown player', async () => {
      const db = await open();
      const row = { ...nhlSeasonStats, playerPublicId: 'nhl-8400001' };
      await expect(upsertSeasonStats(db, [row])).rejects.toThrow(/unknown player nhl-8400001/);
    });
  });

  describe('upsertPlayers', () => {
    async function writeNbaPlayers(db: Db): Promise<void> {
      await upsertTeams(db, nba.teams);
      await upsertPlayers(
        db,
        nba.players,
        overrides(override(embiid.publicId, 'Joel Embiid', 'USA')),
      );
    }

    it('an override sets the nationality to its code with source override', async () => {
      const db = await open();
      await writeNbaPlayers(db);
      const row = await playerRow(db, embiid.publicId);
      expect(row.nationality).toBe('USA');
      expect(row.nationalitySource).toBe('override');
    });

    it('without an override the nationality is the birth country with source birth', async () => {
      const db = await open();
      await writeNbaPlayers(db);
      const row = await playerRow(db, porzingis.publicId);
      expect(row.nationality).toBe('LVA');
      expect(row.nationalitySource).toBe('birth');
    });

    it('without a birth country nationality and its source are null', async () => {
      const db = await open();
      await upsertPlayers(db, [freeAgent], NO_OVERRIDES);
      const row = await playerRow(db, freeAgent.publicId);
      expect(row.nationality).toBeNull();
      expect(row.nationalitySource).toBeNull();
    });

    it('stores a diacritic-free lowercase search_name', async () => {
      const db = await open();
      await writeNbaPlayers(db);
      expect((await playerRow(db, porzingis.publicId)).searchName).toBe('kristaps porzingis');
    });

    it('stores one player_external_ids row with the source and external ID', async () => {
      const db = await open();
      await writeNbaPlayers(db);
      const id = (await playerRow(db, porzingis.publicId)).id;
      const rows = await db
        .select()
        .from(playerExternalIds)
        .where(eq(playerExternalIds.playerId, id));
      expect(rows).toEqual([{ source: 'espn', externalId: '3102531', playerId: id }]);
    });

    it("resolves the current team to that team's row", async () => {
      const db = await open();
      await writeNbaPlayers(db);
      const celticsId = await teamRowId(db, 'espn', celtics.externalId);
      expect((await playerRow(db, porzingis.publicId)).currentTeamId).toBe(celticsId);
    });

    it('a free agent stores current_team_id null', async () => {
      const db = await open();
      await upsertPlayers(db, [freeAgent], NO_OVERRIDES);
      expect((await playerRow(db, freeAgent.publicId)).currentTeamId).toBeNull();
    });

    it("the same player twice in one batch stores one row with the second's values", async () => {
      const db = await open();
      await upsertTeams(db, nhl.teams);
      await upsertPlayers(db, [girgensons, { ...girgensons, jersey: '82' }], NO_OVERRIDES);
      const rows = await db.select().from(players);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.jersey).toBe('82');
    });
  });

  describe('stat line storage', () => {
    it("the same line twice in one batch stores one row with the second's values", async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      const second = { ...girgensonsLine, stats: { ...skaterStats, shots: 5 } };
      await upsertStatLines(db, nhlGame.publicId, [girgensonsLine, second]);
      const rows = await linesOf(db, nhlGame.publicId);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.stats).toEqual({ ...skaterStats, shots: 5 });
    });

    it('a DNP line stores played false, stats null and the reason', async () => {
      const db = await open();
      await writeSlice(db, nba);
      const row = await lineOf(db, nbaGame.publicId, bertansDnpLine.playerPublicId);
      expect(row.played).toBe(false);
      expect(row.stats).toBeNull();
      expect(row.dnpReason).toBe("COACH'S DECISION");
    });
  });

  describe('empty batches', () => {
    it.each<[string, (db: Db) => Promise<number>]>([
      ['upsertTeams', (db) => upsertTeams(db, [])],
      ['upsertPlayers', (db) => upsertPlayers(db, [], NO_OVERRIDES)],
      ['upsertGames', (db) => upsertGames(db, [])],
      ['upsertSeasonStats', (db) => upsertSeasonStats(db, [])],
    ])('%s with an empty batch returns 0', async (_name, write) => {
      const db = await open();
      expect(await write(db)).toBe(0);
    });

    it('upsertStatLines with an empty batch for a game without lines returns 0', async () => {
      const db = await open();
      await writeSliceWithoutLines(db, nhl);
      expect(await upsertStatLines(db, nhlGame.publicId, [])).toBe(0);
    });
  });

  describe('team lookups go by (source, external ID)', () => {
    it.each([
      ['Girgensons', girgensons.publicId, nyi],
      ['Porziņģis', porzingis.publicId, celtics],
    ])("%s's current team is the row of his own source", async (_name, publicId, team) => {
      const db = await open();
      await writeBothSlices(db);
      const expected = await teamRowId(db, team.source, team.externalId);
      expect((await playerRow(db, publicId)).currentTeamId).toBe(expected);
    });

    it.each([
      ['NHL', nhlGame.publicId, cbj, nyi],
      ['NBA', nbaGame.publicId, celtics, sixers],
    ])(
      "the %s game's home and away teams are the rows of its source",
      async (_league, publicId, home, away) => {
        const db = await open();
        await writeBothSlices(db);
        const [row] = await db.select().from(games).where(eq(games.publicId, publicId));
        expect(row?.homeTeamId).toBe(await teamRowId(db, home.source, home.externalId));
        expect(row?.awayTeamId).toBe(await teamRowId(db, away.source, away.externalId));
      },
    );

    it.each([
      ['Girgensons', nhlGame.publicId, girgensons.publicId, nyi],
      ['Porziņģis', nbaGame.publicId, porzingis.publicId, celtics],
    ])(
      "%s's stat line team is the row of the game's source",
      async (_name, gamePublicId, playerPublicId, team) => {
        const db = await open();
        await writeBothSlices(db);
        const line = await lineOf(db, gamePublicId, playerPublicId);
        expect(line.teamId).toBe(await teamRowId(db, team.source, team.externalId));
      },
    );
  });

  describe('job runs', () => {
    it('startJobRun stores the job, args, status running, a start time and no finish time', async () => {
      const db = await open();
      const id = await startJobRun(db, 'results', { league: 'NHL', date: '2026-10-07' });
      const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, id));
      expect(row?.job).toBe('results');
      expect(row?.args).toEqual({ league: 'NHL', date: '2026-10-07' });
      expect(row?.status).toBe('running');
      expect(row?.startedAt).toBeInstanceOf(Date);
      expect(row?.finishedAt).toBeNull();
    });

    it('finishJobRun sets the status, counts, error and finish time', async () => {
      const db = await open();
      const id = await startJobRun(db, 'roster', { league: 'NBA' });
      await finishJobRun(db, id, {
        status: 'partial',
        counts: { teams: 29, players: 512 },
        error: 'team espn/5: timeout',
      });
      const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, id));
      expect(row?.status).toBe('partial');
      expect(row?.counts).toEqual({ teams: 29, players: 512 });
      expect(row?.error).toBe('team espn/5: timeout');
      expect(row?.finishedAt).toBeInstanceOf(Date);
    });
  });
});
