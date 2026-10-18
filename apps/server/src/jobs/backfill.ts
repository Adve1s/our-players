import { ingestDay } from './results';
import type { Job } from './runner';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// The score of a day lists every game, future ones included, so no schedule call is needed.
export const backfillJob: Job = async (ctx, run, args) => {
  const { from, to } = args;
  if (!from || !to || !DAY.test(from) || !DAY.test(to)) {
    throw new Error('backfill needs --from and --to as YYYY-MM-DD');
  }
  if (from > to) throw new Error(`backfill: --from ${from} is after --to ${to}`);
  for (let day = from; day <= to; day = nextDay(day)) {
    await ingestDay(ctx, run, args.league, day);
  }
};
