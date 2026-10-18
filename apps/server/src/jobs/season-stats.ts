import { seasonTypeSchema } from '@our-players/shared';
import { and, eq, lte } from 'drizzle-orm';
import { currentSeason, playedOrPlaying } from '../db/games';
import { games, players } from '../db/schema';
import { upsertSeasonStats } from '../db/season-stats';
import { fetchGoalieSummary, fetchSkaterSummary } from '../sources/nhl';
import type { Job } from './runner';

// Rows are kept for every stored player of the league, active or not: a player waived or sent down
// mid-season still has real totals. The rest of the league's rows are counted as skipped.
export const seasonStatsJob: Job = async (ctx, run, args) => {
  if (args.league !== 'NHL') throw new Error(`${args.league.toLowerCase()} arrives in S05`);
  const now = ctx.now();
  const season = await currentSeason(ctx.db, args.league, now);
  if (season === null) {
    run.log.info('no games stored, no season to fetch');
    return;
  }
  const startedTypes = await ctx.db
    .selectDistinct({ seasonType: games.seasonType })
    .from(games)
    .where(
      and(
        eq(games.league, args.league),
        eq(games.season, season),
        lte(games.startTimeUtc, now),
        playedOrPlaying,
      ),
    );
  const types = seasonTypeSchema.options.filter((t) =>
    startedTypes.some((r) => r.seasonType === t),
  );
  if (types.length === 0) {
    run.log.info(`no started game in ${season} yet`, { season });
    return;
  }
  const stored = new Set(
    (
      await ctx.db
        .select({ publicId: players.publicId })
        .from(players)
        .where(eq(players.league, args.league))
    ).map((p) => p.publicId),
  );
  for (const seasonType of types) {
    const rows = [
      ...(await fetchSkaterSummary(ctx.client, season, seasonType)),
      ...(await fetchGoalieSummary(ctx.client, season, seasonType)),
    ];
    const kept = rows.filter((r) => stored.has(r.playerPublicId));
    run.add('rows', await upsertSeasonStats(ctx.db, kept));
    run.add('skipped', rows.length - kept.length);
  }
};
