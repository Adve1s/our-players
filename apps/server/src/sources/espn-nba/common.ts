import {
  type CountryCode,
  countryFromName,
  type Player,
  type PositionGroup,
  type SeasonType,
  seasonLabel,
  type Team,
} from '@our-players/shared';
import type { z } from 'zod';
import { lookup, parsePayload as parseSourcePayload } from '../common';

export { lookup };

// `where` in the helpers below is the message prefix naming source, endpoint and the game or
// player ("espn-nba scoreboard: game 401810899"), so a mapping failure is traceable from one log line.

export function parsePayload<T>(schema: z.ZodType<T>, endpoint: string, raw: unknown): T {
  return parseSourcePayload('espn-nba', schema, endpoint, raw);
}

export const SEASON_TYPES: Readonly<Record<number, SeasonType>> = { 1: 'PRE', 2: 'REG', 3: 'POST' };

// ESPN labels a season by its end year: 2027 → "2026-27".
export function seasonFromYear(year: number): string {
  return seasonLabel(year - 1);
}

// "NA" is ESPN's "Not Available" (a player it lists without one), so position and group stay null.
const POSITION_GROUPS: Readonly<Record<string, PositionGroup | null>> = {
  G: 'guard',
  PG: 'guard',
  SG: 'guard',
  F: 'forward',
  SF: 'forward',
  PF: 'forward',
  C: 'center',
  NA: null,
};

export function position(code: string, where: string): Pick<Player, 'position' | 'positionGroup'> {
  const group = lookup(POSITION_GROUPS, code);
  if (group === undefined) throw new Error(`${where}: unknown position "${code}"`);
  return { position: group === null ? null : code, positionGroup: group };
}

export function toTeam(t: { id: string; abbreviation: string; name: string }): Team {
  return { league: 'NBA', source: 'espn', externalId: t.id, abbrev: t.abbreviation, name: t.name };
}

// Rule 6 takes the birth country as nationality, so an unknown name becomes null plus a warning.
export function birthCountry(
  name: string | undefined,
  where: string,
  warnings: string[],
): CountryCode | null {
  if (name === undefined) return null;
  const code = countryFromName(name);
  if (!code) warnings.push(`${where}: unknown birth country "${name}"`);
  return code;
}
