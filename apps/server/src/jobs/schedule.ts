import { usGameDay } from '@our-players/shared';
import { upsertGames } from '../db/games';
import { upsertTeams } from '../db/teams';
import { ADAPTERS } from './adapters';
import type { Job } from './runner';

// upsertGames keeps a stored FINAL game and its score-derived period scores, so a stale week can't undo results.
export const scheduleJob: Job = async (ctx, run, args) => {
  const date = args.date ?? usGameDay(ctx.now());
  const { games, teams, warnings } = await ADAPTERS[args.league].week(ctx.client, date);
  for (const w of warnings) run.log.warn(w);
  run.add('teams', await upsertTeams(ctx.db, teams));
  run.add('games', await upsertGames(ctx.db, games));
};
