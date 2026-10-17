import type { Player, StatLine, Team } from '@our-players/shared';

export function mapBoxscore(_raw: unknown): {
  lines: StatLine[];
  teams: Team[];
  players: Player[];
} {
  throw new Error('not implemented');
}
