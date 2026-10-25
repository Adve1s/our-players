import type { Player } from '@our-players/shared';
import type { z } from 'zod';
import { birthCountry, parsePayload, position } from './common';
import { athleteSchema, rosterSchema } from './schemas';

type Bio = Omit<z.output<typeof athleteSchema>, 'team'>;

function toPlayer(
  endpoint: string,
  p: Bio,
  teamExternalId: string | null,
  warnings: string[],
): Player {
  const where = `espn-nba ${endpoint}: player ${p.id}`;
  return {
    publicId: `nba-${p.id}`,
    league: 'NBA',
    source: 'espn',
    externalId: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    ...position(p.position.abbreviation, where),
    currentTeamExternalId: teamExternalId,
    jersey: p.jersey ?? null,
    // "1995-08-02T07:00Z" → "1995-08-02"
    birthDate: p.dateOfBirth?.slice(0, 10) ?? null,
    birthCity: p.birthPlace?.city ?? null,
    birthCountry: birthCountry(p.birthPlace?.country, where, warnings),
  };
}

// The roster names its team, so mapRoster returns it.
export function mapRoster(raw: unknown): {
  teamExternalId: string;
  players: Player[];
  warnings: string[];
} {
  const roster = parsePayload(rosterSchema, 'roster', raw);
  const warnings: string[] = [];
  const players = roster.athletes.map((p) => toPlayer('roster', p, roster.team.id, warnings));
  return { teamExternalId: roster.team.id, players, warnings };
}

export function mapAthlete(raw: unknown): { player: Player; warnings: string[] } {
  const p = parsePayload(athleteSchema, 'athlete', raw);
  const warnings: string[] = [];
  // "…/seasons/2027/teams/9?lang=en" → "9"; a free agent or retired player has no team.
  let team: string | null = null;
  if (p.team) {
    const match = /\/teams\/(\d+)/.exec(p.team.$ref);
    if (!match?.[1])
      throw new Error(`espn-nba athlete: player ${p.id}: unknown team ref "${p.team.$ref}"`);
    team = match[1];
  }
  return { player: toPlayer('athlete', p, team, warnings), warnings };
}
