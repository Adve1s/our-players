import type { EndedIn, GameStatus } from './enums';
import type { BasketballPlayerStats, HockeyGoalieStats, HockeySkaterStats } from './stats';

// A played server line and the contract's line both fit, so the recap and the app share the card text.
export type LineStats =
  | { kind: 'hockey_skater'; stats: HockeySkaterStats }
  | { kind: 'hockey_goalie'; stats: HockeyGoalieStats }
  | { kind: 'basketball_player'; stats: BasketballPlayerStats };

export function toi(_seconds: number): string {
  throw new Error('not implemented');
}

export function savePct(_pct: number): string {
  throw new Error('not implemented');
}

export function signed(_n: number): string {
  throw new Error('not implemented');
}

export function lineText(_line: LineStats): string[] {
  throw new Error('not implemented');
}

export function finalLabel(_endedIn: EndedIn | null): string {
  throw new Error('not implemented');
}

export function upcomingText(_status: GameStatus): string {
  throw new Error('not implemented');
}
