import {
  dnpText,
  type GameLogEntry,
  lineText,
  type PlayerResponse,
  type SeasonStatsEntry,
  savePct,
  signed,
  toi,
} from '@our-players/shared';
import { dayLabel, scoreText, statusLabel } from './format';

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
      return cells([
        ['GP', s.gamesPlayed],
        ['MIN', avg(s.minutes)],
        ['PTS', avg(s.points)],
        ['REB', avg(s.rebounds)],
        ['AST', avg(s.assists)],
        ['FG%', pct(s.fgPct)],
        ['3P%', pct(s.threePct)],
        ['FT%', pct(s.ftPct)],
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

export function bioLines(p: PlayerResponse, today: string): string[] {
  const team = [p.team?.abbrev ?? 'No team', p.league, p.position];
  if (p.jersey !== null) team.push(`#${p.jersey}`);
  const born = [p.birthCity, p.birthCountry].filter((part) => part !== null).join(', ');
  const life = [
    p.birthDate === null ? null : `Age ${age(p.birthDate, today)}`,
    born === '' ? null : `Born ${born}`,
  ].filter((part) => part !== null);
  const lines = [team.join(' · ')];
  if (life.length > 0) lines.push(life.join(' · '));
  if (p.nationality !== null)
    lines.push(
      `Nationality ${p.nationality}${p.nationalitySource === 'override' ? ' (override)' : ''}`,
    );
  return lines;
}

export const logCaption = (entry: GameLogEntry, locale?: string, timeZone?: string): string =>
  `${dayLabel(entry.game.gameDate)} · ${scoreText(entry.game)} · ${statusLabel(entry.game, locale, timeZone)}`;

export const logLines = (entry: GameLogEntry): string[] =>
  entry.type === 'line' ? lineText(entry.line) : [dnpText(entry.reason)];
