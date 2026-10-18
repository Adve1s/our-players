import type { League, PublicId } from '@our-players/shared';
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { upsertGames, upsertStatLines } from '../db/games';
import { upsertPlayers } from '../db/players';
import { games, players, teams } from '../db/schema';
import { upsertTeams } from '../db/teams';
import { fetchBoxscore, fetchPlayerLanding, fetchScore } from '../sources/nhl';
import type { Job, JobContext, JobRun } from './runner';

export const CORRECTION_DELAY_MS = 6 * 60 * 60 * 1000;
// Regular-season games end within ~3.5 h, so a box score first fetched this long after the start is past CORRECTION_DELAY_MS.
export const SETTLED_AFTER_START_MS = 12 * 60 * 60 * 1000;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Without --date: the days of started games that aren't final, and of final games without a box score.
// Then each final box score is re-fetched once, CORRECTION_DELAY_MS after the final horn, for stat corrections.
// shortcut: a game that stays SCHEDULED/LIVE after its start keeps its day a candidate (PR #8), so each run re-fetches that score; the scheduler bounds the trigger to a 24 h window, a job-side cutoff if a stuck game ever costs too many calls
export const resultsJob: Job = async (ctx, run, args) => {
  const days = args.date
    ? [args.date]
    : (
        await ctx.db
          .selectDistinct({ day: games.gameDate })
          .from(games)
          .where(
            and(
              eq(games.league, args.league),
              or(
                and(
                  inArray(games.status, ['SCHEDULED', 'LIVE']),
                  lte(games.startTimeUtc, ctx.now()),
                ),
                and(eq(games.status, 'FINAL'), isNull(games.boxscoreFetchedAt)),
              ),
            ),
          )
          .orderBy(games.gameDate)
      ).map((r) => r.day);
  for (const day of days) await ingestDay(ctx, run, args.league, day);

  const due = await ctx.db
    .select({ publicId: games.publicId, externalId: games.externalId })
    .from(games)
    .where(
      and(
        eq(games.league, args.league),
        eq(games.status, 'FINAL'),
        isNotNull(games.boxscoreFetchedAt),
        isNull(games.correctedAt),
        lte(games.finalAt, new Date(ctx.now().getTime() - CORRECTION_DELAY_MS)),
      ),
    );
  for (const game of due) {
    try {
      await finalizeGame(ctx, run, game, 'correction');
    } catch (e) {
      // corrected_at stays null, so the next run retries this game.
      run.fail(`correction ${game.publicId}: ${message(e)}`);
    }
  }
};

// One day is one unit: a failure is recorded and the caller moves on to the next day.
export async function ingestDay(
  ctx: JobContext,
  run: JobRun,
  league: League,
  day: string,
): Promise<void> {
  run.add('days');
  try {
    if (league !== 'NHL') throw new Error(`${league.toLowerCase()} arrives in S05`);
    const score = await fetchScore(ctx.client, day);
    for (const w of score.warnings) run.log.warn(w);
    await upsertTeams(ctx.db, score.teams);
    run.add('games', await upsertGames(ctx.db, score.games));
    const ofDay = and(eq(games.league, league), eq(games.gameDate, day), eq(games.status, 'FINAL'));
    await ctx.db
      .update(games)
      .set({ finalAt: sql`now()` })
      .where(and(ofDay, isNull(games.finalAt)));
    const unfetched = await ctx.db
      .select({
        publicId: games.publicId,
        externalId: games.externalId,
        startTimeUtc: games.startTimeUtc,
      })
      .from(games)
      .where(and(ofDay, isNull(games.boxscoreFetchedAt)));
    const settledBy = new Date(ctx.now().getTime() - SETTLED_AFTER_START_MS);
    for (const { startTimeUtc, ...game } of unfetched) {
      try {
        await finalizeGame(ctx, run, game, startTimeUtc <= settledBy ? 'settled' : 'first');
      } catch (e) {
        // boxscore_fetched_at stays null, so the next run retries this game.
        run.fail(`game ${game.publicId}: ${message(e)}`);
      }
    }
  } catch (e) {
    run.fail(`day ${day}: ${message(e)}`);
  }
}

async function finalizeGame(
  ctx: JobContext,
  run: JobRun,
  game: { publicId: PublicId; externalId: string },
  // settled: a first fetch late enough after the start to stand as the correction too.
  mode: 'first' | 'settled' | 'correction',
): Promise<void> {
  const box = await fetchBoxscore(ctx.client, game.externalId);
  await upsertTeams(ctx.db, box.teams);
  const stored = new Set(
    (
      await ctx.db
        .select({ publicId: players.publicId })
        .from(players)
        .where(
          inArray(
            players.publicId,
            box.players.map((p) => p.publicId),
          ),
        )
    ).map((r) => r.publicId),
  );
  // A stored player is never overwritten by a stub: stub first names are initials ("E.").
  for (const stub of box.players.filter((p) => !stored.has(p.publicId))) {
    try {
      const { player, warnings } = await fetchPlayerLanding(ctx.client, stub.externalId);
      for (const w of warnings) run.log.warn(w);
      const team = player.currentTeamExternalId;
      const teamStored =
        team === null ||
        (
          await ctx.db
            .select({ id: teams.id })
            .from(teams)
            .where(and(eq(teams.source, player.source), eq(teams.externalId, team)))
        ).length > 0;
      // The box score's team is historical, so it isn't used; the roster job sets the team.
      if (!teamStored) {
        run.log.warn(
          `player ${player.publicId}: current team ${player.source}/${team} is not stored, team left null`,
        );
      }
      await upsertPlayers(
        ctx.db,
        [teamStored ? player : { ...player, currentTeamExternalId: null }],
        ctx.overrides,
      );
      run.add('enriched');
    } catch (e) {
      // The line is never dropped: the stub stands in until a roster run names the player.
      run.log.warn(`player ${stub.publicId}: enrichment failed, stub written: ${message(e)}`);
      // The box score's team is historical on a backfill, so the stub gets none.
      await upsertPlayers(ctx.db, [{ ...stub, currentTeamExternalId: null }], ctx.overrides);
      run.add('stubs');
      run.fail(`player ${stub.publicId}: ${message(e)}`);
    }
  }
  run.add('lines', await upsertStatLines(ctx.db, game.publicId, box.lines));
  await ctx.db
    .update(games)
    .set(
      mode === 'first'
        ? { boxscoreFetchedAt: sql`now()` }
        : mode === 'settled'
          ? { boxscoreFetchedAt: sql`now()`, correctedAt: sql`now()` }
          : { correctedAt: sql`now()` },
    )
    .where(eq(games.publicId, game.publicId));
  run.add(mode === 'correction' ? 'corrected' : 'finalized');
}
