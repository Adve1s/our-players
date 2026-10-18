import type { Player } from '@our-players/shared';

// The roster names its team, so mapRoster returns it.
export function mapRoster(raw: unknown): {
  teamExternalId: string;
  players: Player[];
  warnings: string[];
} {
  throw new Error('not implemented');
}

export function mapAthlete(raw: unknown): { player: Player; warnings: string[] } {
  throw new Error('not implemented');
}
