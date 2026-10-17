import { describe, expectTypeOf, it } from 'vitest';
import type { HockeySkaterStats, StatLine } from '../src/index';

// Type-level: these fail `pnpm typecheck`, not the test run.
type Base = {
  gamePublicId: string;
  playerPublicId: string;
  teamExternalId: string;
  dnpReason: string | null;
  starter: boolean | null;
  kind: 'hockey_skater';
};

describe('StatLine', () => {
  it('a played line carries stats, a DNP line carries none', () => {
    expectTypeOf<Base & { played: true; stats: HockeySkaterStats }>().toExtend<StatLine>();
    expectTypeOf<Base & { played: false; stats: null }>().toExtend<StatLine>();
    expectTypeOf<Base & { played: true; stats: null }>().not.toExtend<StatLine>();
    expectTypeOf<Base & { played: false; stats: HockeySkaterStats }>().not.toExtend<StatLine>();
  });
});
