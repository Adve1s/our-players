import type { Player } from '@our-players/shared';

export function mapRoster(
  _raw: unknown,
  _teamExternalId: string,
): { players: Player[]; warnings: string[] } {
  throw new Error('not implemented');
}

export function mapPlayerLanding(_raw: unknown): { player: Player; warnings: string[] } {
  throw new Error('not implemented');
}
