import { type Player, usGameDay } from '@our-players/shared';
import { and, eq, inArray, isNotNull, notInArray, or, sql } from 'drizzle-orm';
import { upsertPlayers } from '../db/players';
import { players } from '../db/schema';
import { upsertTeams } from '../db/teams';
import { recomputeNationalities } from '../nationality/recompute';
import { ADAPTERS } from './adapters';
import type { Job } from './runner';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// The team list comes from the calendar, not stored teams: a missing team would wrongly deactivate its players.
export const rosterJob: Job = async (ctx, run, args) => {
  const adapter = ADAPTERS[args.league];
  const date = args.date ?? usGameDay(ctx.now());
  const { teams } = await adapter.teams(ctx.client, date);
  if (teams.length === 0) throw new Error(`schedule-calendar ${date}: no teams`);
  await upsertTeams(ctx.db, teams);
  run.add('teams', teams.length);

  const collected: Player[] = [];
  let failed = 0;
  for (const team of teams) {
    try {
      const roster = await adapter.roster(ctx.client, team);
      // An empty roster would deactivate the whole team, so it is treated like a failed fetch.
      if (roster.players.length === 0) throw new Error('empty roster');
      for (const w of roster.warnings) run.log.warn(w);
      collected.push(...roster.players);
    } catch (e) {
      failed++;
      run.fail(`roster ${team.abbrev}: ${message(e)}`);
    }
  }
  run.add('teamsFailed', failed);
  run.add('players', await upsertPlayers(ctx.db, collected, ctx.overrides));

  // VISION §6.1: an incomplete roster set can't tell "left the league" from "fetch failed".
  if (failed === 0) {
    const ids = collected.map((p) => p.publicId);
    const ofLeague = eq(players.league, args.league);
    const deactivated = await ctx.db
      .update(players)
      .set({ active: false, currentTeamId: null, updatedAt: sql`now()` })
      .where(
        and(
          ofLeague,
          notInArray(players.publicId, ids),
          or(eq(players.active, true), isNotNull(players.currentTeamId)),
        ),
      )
      .returning({ id: players.id });
    const reactivated = await ctx.db
      .update(players)
      .set({ active: true, updatedAt: sql`now()` })
      .where(and(ofLeague, inArray(players.publicId, ids), eq(players.active, false)))
      .returning({ id: players.id });
    run.add('deactivated', deactivated.length);
    run.add('reactivated', reactivated.length);
  }

  const recomputed = await recomputeNationalities(ctx.db, ctx.overrides);
  for (const w of recomputed.warnings) run.log.warn(w);
  run.add('nationalitiesUpdated', recomputed.updated);
};
