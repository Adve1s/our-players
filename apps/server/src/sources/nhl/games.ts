import type { Game, Team } from '@our-players/shared';

export function mapScore(_raw: unknown): { games: Game[]; teams: Team[] } {
  throw new Error('not implemented');
}

export function mapSchedule(_raw: unknown): { games: Game[]; teams: Team[] } {
  throw new Error('not implemented');
}
