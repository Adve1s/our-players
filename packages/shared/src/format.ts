import type { EndedIn, GameStatus } from './enums';
import type { BasketballPlayerStats, HockeyGoalieStats, HockeySkaterStats } from './stats';

// A played server line and the contract's line both fit, so the recap and the app share the card text.
export type LineStats =
  | { kind: 'hockey_skater'; stats: HockeySkaterStats }
  | { kind: 'hockey_goalie'; stats: HockeyGoalieStats }
  | { kind: 'basketball_player'; stats: BasketballPlayerStats };

export const toi = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const savePct = (pct: number): string => pct.toFixed(3).replace(/^0/, '');

export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

// Card text per VISION §4.1; basketball takes two lines (counting stats, then shooting).
export function lineText(line: LineStats): string[] {
  switch (line.kind) {
    case 'hockey_skater': {
      const s = line.stats;
      return [
        `${s.goals} G · ${s.assists} A · ${signed(s.plusMinus)} · ${s.shots} SOG · ${toi(s.toiSeconds)}`,
      ];
    }
    case 'hockey_goalie': {
      const s = line.stats;
      const parts = [
        `${s.saves}/${s.shotsAgainst}`,
        s.savePct === null ? null : savePct(s.savePct),
        `${s.goalsAgainst} GA`,
        s.decision,
      ];
      return [parts.filter((part) => part !== null).join(' · ')];
    }
    case 'basketball_player': {
      const s = line.stats;
      return [
        `${s.points} PTS · ${s.rebounds} REB · ${s.assists} AST · ${s.minutes} MIN`,
        `FG ${s.fgMade}-${s.fgAttempted} · 3PT ${s.threeMade}-${s.threeAttempted} · FT ${s.ftMade}-${s.ftAttempted}`,
      ];
    }
  }
}

export const finalLabel = (endedIn: EndedIn | null): string =>
  endedIn === 'OT' || endedIn === 'SO' ? `Final/${endedIn}` : 'Final';

// D-049: an upcoming row's text follows the game's status; the server never sends POSTPONED or CANCELLED ones.
export function upcomingText(status: GameStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return 'Not started';
    case 'LIVE':
      return 'In progress';
    case 'FINAL':
      return 'Waiting for stats';
    case 'POSTPONED':
      return 'Postponed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

// ESPN sends reasons in capitals ("COACH'S DECISION").
export const sentenceCase = (s: string): string => {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export const dnpText = (reason: string | null): string =>
  reason === null ? 'DNP' : `DNP — ${sentenceCase(reason)}`;
