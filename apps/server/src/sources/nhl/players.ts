import type { Player } from '@our-players/shared';
import type { z } from 'zod';
import { birthCountry, parsePayload, positionGroup } from './common';
import { playerLandingSchema, rosterSchema } from './schemas';

type Bio = z.output<typeof playerLandingSchema>;

function toPlayer(
  endpoint: string,
  id: number,
  position: string,
  teamExternalId: string | null,
  p: Omit<Bio, 'playerId' | 'position' | 'currentTeamId'>,
  warnings: string[],
): Player {
  const where = `nhl ${endpoint}: player ${id}`;
  return {
    publicId: `nhl-${id}`,
    league: 'NHL',
    source: 'nhl',
    externalId: String(id),
    firstName: p.firstName.default,
    lastName: p.lastName.default,
    position,
    positionGroup: positionGroup(position, where),
    currentTeamExternalId: teamExternalId,
    jersey: p.sweaterNumber === undefined ? null : String(p.sweaterNumber),
    birthDate: p.birthDate ?? null,
    birthCity: p.birthCity?.default ?? null,
    birthCountry: birthCountry(p.birthCountry, where, warnings),
  };
}

// A roster response doesn't name its team, so the caller passes the one it asked for.
export function mapRoster(
  raw: unknown,
  teamExternalId: string,
): { players: Player[]; warnings: string[] } {
  const roster = parsePayload(rosterSchema, 'roster', raw);
  const warnings: string[] = [];
  const players = [...roster.forwards, ...roster.defensemen, ...roster.goalies].map((p) =>
    toPlayer('roster', p.id, p.positionCode, teamExternalId, p, warnings),
  );
  return { players, warnings };
}

export function mapPlayerLanding(raw: unknown): { player: Player; warnings: string[] } {
  const p = parsePayload(playerLandingSchema, 'player-landing', raw);
  const warnings: string[] = [];
  // A retired player has no currentTeamId.
  const team = p.currentTeamId === undefined ? null : String(p.currentTeamId);
  return {
    player: toPlayer('player-landing', p.playerId, p.position, team, p, warnings),
    warnings,
  };
}
