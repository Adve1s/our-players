import type { Game, Team } from '@our-players/shared';

export type EspnGames = { games: Game[]; teams: Team[]; warnings: string[] };

export function mapScoreboard(raw: unknown, gameDate: string): EspnGames {
  throw new Error('not implemented');
}
