import { upsertGames } from '../db/games';
import { upsertTeams } from '../db/teams';
import { fetchSchedule } from '../sources/nhl';
import type { Job } from './runner';

// upsertGames keeps a stored FINAL game and its score-derived period scores, so a stale week can't undo results.
export const scheduleJob: Job = async (ctx, run, args) => {
  if (args.league !== 'NHL') throw new Error(`${args.league.toLowerCase()} arrives in S05`);
  const date = args.date ?? ctx.now().toISOString().slice(0, 10);
  const { games, teams, warnings } = await fetchSchedule(ctx.client, date);
  for (const w of warnings) run.log.warn(w);
  run.add('teams', await upsertTeams(ctx.db, teams));
  run.add('games', await upsertGames(ctx.db, games));
};
