import {
  type GameLogEntry,
  type PlayerResponse,
  type SeasonStatsEntry,
  savePct,
  signed,
  toi,
} from '@our-players/shared';
import { scoreText, statusLabel } from './format';

export type Cell = { label: string; value: string };

const DASH = '–';
const pct = (p: number) => (p * 100).toFixed(1);

export function seasonCells(entry: SeasonStatsEntry): Cell[] {
  const cells = (pairs: [string, string | number][]) =>
    pairs.map(([label, value]) => ({ label, value: String(value) }));
  switch (entry.kind) {
    case 'hockey_skater': {
      const s = entry.stats;
      return cells([
        ['GP', s.gamesPlayed],
        ['G', s.goals],
        ['A', s.assists],
        ['PTS', s.points],
        ['+/-', signed(s.plusMinus)],
        ['SOG', s.shots],
        ['TOI/GP', toi(Math.round(s.toiPerGameSeconds))],
      ]);
    }
    case 'hockey_goalie': {
      const s = entry.stats;
      return cells([
        ['GP', s.gamesPlayed],
        ['W', s.wins],
        ['L', s.losses],
        ['OTL', s.otLosses],
        ['GAA', s.goalsAgainstAverage.toFixed(2)],
        ['SV%', s.savePct === undefined ? DASH : savePct(s.savePct)],
        ['SO', s.shutouts],
      ]);
    }
    case 'basketball_player': {
      const s = entry.stats;
      // D-043: ESPN's season rows are totals; per game is what ESPN's own avg* fields show.
      const avg = (n: number) =>
        s.gamesPlayed === 0 ? DASH : (entry.basis === 'totals' ? n / s.gamesPlayed : n).toFixed(1);
      const share = (p: number) => (s.gamesPlayed === 0 ? DASH : pct(p));
      return cells([
        ['GP', s.gamesPlayed],
        ['MIN', avg(s.minutes)],
        ['PTS', avg(s.points)],
        ['REB', avg(s.rebounds)],
        ['AST', avg(s.assists)],
        ['FG%', share(s.fgPct)],
        ['3P%', share(s.threePct)],
        ['FT%', share(s.ftPct)],
      ]);
    }
  }
}

const SEASON_TYPES = { PRE: 'Preseason', REG: 'Regular season', POST: 'Playoffs' } as const;

export const seasonHeading = (entry: SeasonStatsEntry): string =>
  `${SEASON_TYPES[entry.seasonType]} ${entry.season}`;

// Both YYYY-MM-DD, so the month-day parts compare as strings.
export function age(birthDate: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

export const playerSubtitle = (p: PlayerResponse): string =>
  [p.team?.name ?? 'No team', p.league, p.jersey === null ? null : `#${p.jersey}`]
    .filter((part) => part !== null)
    .join(', ');

export function bioRows(p: PlayerResponse, today: string): Cell[] {
  const born = [p.birthCity, p.birthCountry].filter((part) => part !== null).join(', ');
  const nationality =
    p.nationality === null
      ? null
      : `${p.nationality}${p.nationalitySource === 'override' ? ' (override)' : ''}`;
  const rows: [string, string | null][] = [
    ['Position', p.position],
    ['Age', p.birthDate === null ? null : String(age(p.birthDate, today))],
    ['Born', born === '' ? null : born],
    ['Nationality', nationality],
  ];
  return rows.flatMap(([label, value]) => (value === null ? [] : [{ label, value }]));
}

// The day leads the log row on its own line, so the caption is the game alone.
export const logCaption = (entry: GameLogEntry, locale?: string, timeZone?: string): string =>
  `${scoreText(entry.game)}, ${statusLabel(entry.game, locale, timeZone)}`;
