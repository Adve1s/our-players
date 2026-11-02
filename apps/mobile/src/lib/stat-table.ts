import {
  type BasketballPlayerStats,
  type HockeyGoalieStats,
  type HockeySkaterStats,
  type LineStats,
  savePct,
  signed,
  toi,
} from '@our-players/shared';
import { layout } from '../tokens';

export type LineKind = LineStats['kind'];
export type ColumnSet = 'today' | 'box';
export type Column = { label: string; wide: boolean; strong: boolean };
export type RowGroup<R> = { kind: LineKind | null; rows: R[] };

type Cell<S> = Column & { value: (s: S) => string };

const DASH = '–';
const opt = (n: number | null | undefined): string => (n == null ? DASH : String(n));
const cell = <S>(label: string, value: (s: S) => string, wide = false): Cell<S> => ({
  label,
  wide,
  strong: false,
  value,
});
// The headline numbers of a set (the approved mockups set them bold).
const strong = <S>(c: Cell<S>): Cell<S> => ({ ...c, strong: true });

const skater = {
  G: cell<HockeySkaterStats>('G', (s) => String(s.goals)),
  A: cell<HockeySkaterStats>('A', (s) => String(s.assists)),
  PTS: cell<HockeySkaterStats>('PTS', (s) => String(s.points)),
  PM: cell<HockeySkaterStats>('+/-', (s) => signed(s.plusMinus)),
  SOG: cell<HockeySkaterStats>('SOG', (s) => String(s.shots)),
  TOI: cell<HockeySkaterStats>('TOI', (s) => toi(s.toiSeconds), true),
  PIM: cell<HockeySkaterStats>('PIM', (s) => opt(s.pim)),
  HIT: cell<HockeySkaterStats>('HIT', (s) => opt(s.hits)),
  BLK: cell<HockeySkaterStats>('BLK', (s) => opt(s.blocks)),
  PPG: cell<HockeySkaterStats>('PPG', (s) => opt(s.powerPlayGoals)),
};
const goalie = {
  SVSA: cell<HockeyGoalieStats>('SV/SA', (s) => `${s.saves}/${s.shotsAgainst}`, true),
  // Wide: a shutout's "1.000" wraps in a narrow column.
  SVP: cell<HockeyGoalieStats>(
    'SV%',
    (s) => (s.savePct === null ? DASH : savePct(s.savePct)),
    true,
  ),
  GA: cell<HockeyGoalieStats>('GA', (s) => String(s.goalsAgainst)),
  TOI: cell<HockeyGoalieStats>('TOI', (s) => toi(s.toiSeconds), true),
  DEC: cell<HockeyGoalieStats>('DEC', (s) => s.decision ?? DASH),
};
const ball = {
  MIN: cell<BasketballPlayerStats>('MIN', (s) => String(s.minutes)),
  PTS: cell<BasketballPlayerStats>('PTS', (s) => String(s.points)),
  REB: cell<BasketballPlayerStats>('REB', (s) => String(s.rebounds)),
  AST: cell<BasketballPlayerStats>('AST', (s) => String(s.assists)),
  FG: cell<BasketballPlayerStats>('FG', (s) => `${s.fgMade}-${s.fgAttempted}`, true),
  TP: cell<BasketballPlayerStats>('3PT', (s) => `${s.threeMade}-${s.threeAttempted}`, true),
  FT: cell<BasketballPlayerStats>('FT', (s) => `${s.ftMade}-${s.ftAttempted}`, true),
  OREB: cell<BasketballPlayerStats>('OREB', (s) => String(s.offRebounds)),
  DREB: cell<BasketballPlayerStats>('DREB', (s) => String(s.defRebounds)),
  STL: cell<BasketballPlayerStats>('STL', (s) => String(s.steals)),
  BLK: cell<BasketballPlayerStats>('BLK', (s) => String(s.blocks)),
  TO: cell<BasketballPlayerStats>('TO', (s) => String(s.turnovers)),
  PF: cell<BasketballPlayerStats>('PF', (s) => String(s.fouls)),
  PM: cell<BasketballPlayerStats>('+/-', (s) => signed(s.plusMinus)),
};

const SETS = {
  hockey_skater: {
    today: [strong(skater.G), strong(skater.A), skater.PM, skater.SOG, skater.TOI],
    box: [
      skater.G,
      skater.A,
      strong(skater.PTS),
      skater.PM,
      skater.SOG,
      skater.TOI,
      skater.PIM,
      skater.HIT,
      skater.BLK,
      skater.PPG,
    ],
  },
  hockey_goalie: {
    today: [goalie.SVSA, goalie.SVP, goalie.GA, strong(goalie.DEC)],
    box: [goalie.SVSA, goalie.SVP, goalie.GA, goalie.TOI, goalie.DEC],
  },
  basketball_player: {
    today: [strong(ball.PTS), ball.REB, ball.AST, ball.MIN],
    box: [
      ball.MIN,
      strong(ball.PTS),
      ball.REB,
      ball.AST,
      ball.FG,
      ball.TP,
      ball.FT,
      ball.OREB,
      ball.DREB,
      ball.STL,
      ball.BLK,
      ball.TO,
      ball.PF,
      ball.PM,
    ],
  },
};

export const columns = (kind: LineKind, set: ColumnSet): Column[] =>
  SETS[kind][set].map(({ label, wide, strong }) => ({ label, wide, strong }));

export function values(line: LineStats, set: ColumnSet): string[] {
  // One case per kind: TS can't correlate SETS[line.kind] with line.stats.
  switch (line.kind) {
    case 'hockey_skater':
      return SETS.hockey_skater[set].map((c) => c.value(line.stats));
    case 'hockey_goalie':
      return SETS.hockey_goalie[set].map((c) => c.value(line.stats));
    case 'basketball_player':
      return SETS.basketball_player[set].map((c) => c.value(line.stats));
  }
}

type Row = { type: string; line?: LineStats };
const kindOf = (row: Row): LineKind | null => row.line?.kind ?? null;

export function todayGroups<R extends Row>(rows: R[]): RowGroup<R>[] {
  const groups: RowGroup<R>[] = [];
  for (const row of rows) {
    const kind = kindOf(row);
    const last = groups.at(-1);
    if (last && last.kind === kind) last.rows.push(row);
    else groups.push({ kind, rows: [row] });
  }
  return groups;
}

// Skaters (or basketball players) lead, goalies follow, text rows close the box.
const BOX_ORDER: (LineKind | null)[] = [
  'hockey_skater',
  'basketball_player',
  'hockey_goalie',
  null,
];

export const boxGroups = <R extends Row>(rows: R[]): RowGroup<R>[] =>
  BOX_ORDER.map((kind) => ({ kind, rows: rows.filter((row) => kindOf(row) === kind) })).filter(
    (group) => group.rows.length > 0,
  );

export const columnWidth = (wide: boolean, fontScale: number): number =>
  Math.ceil((wide ? layout.statColumnWide : layout.statColumn) * Math.max(1, fontScale));
