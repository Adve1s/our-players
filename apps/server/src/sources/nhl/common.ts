import {
  type CountryCode,
  countryCodeSchema,
  type PositionGroup,
  seasonLabel,
  type Team,
} from '@our-players/shared';
import type { z } from 'zod';
import { lookup, parsePayload as parseSourcePayload } from '../common';

export { lookup };

// `where` in the helpers below is the message prefix naming source, endpoint and the game or
// player ("nhl score: game 2025020760"), so a mapping failure is traceable from one log line.

export function parsePayload<T>(schema: z.ZodType<T>, endpoint: string, raw: unknown): T {
  return parseSourcePayload('nhl', schema, endpoint, raw);
}

// 20252026 → "2025-26"; anything else is a season ID we don't understand, not a guess.
export function seasonFromId(seasonId: number, where: string): string {
  const match = /^(\d{4})(\d{4})$/.exec(String(seasonId));
  const start = Number(match?.[1]);
  if (!match || Number(match[2]) !== start + 1) {
    throw new Error(`${where}: unknown season ${seasonId}`);
  }
  return seasonLabel(start);
}

// "MM:SS"; minutes go past 59 (a 65-minute shootout game is "65:00").
export function toiSeconds(toi: string, where: string): number {
  const match = /^(\d+):([0-5]\d)$/.exec(toi);
  if (!match) throw new Error(`${where}: malformed toi "${toi}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

const POSITION_GROUPS: Readonly<Record<string, PositionGroup>> = {
  C: 'forward',
  L: 'forward',
  R: 'forward',
  D: 'defense',
  G: 'goalie',
};

export function positionGroup(code: string, where: string): PositionGroup {
  const group = lookup(POSITION_GROUPS, code);
  if (!group) throw new Error(`${where}: unknown position "${code}"`);
  return group;
}

export function toTeam(id: number, abbrev: string, name: string): Team {
  return { league: 'NHL', source: 'nhl', externalId: String(id), abbrev, name };
}

// Rule 6 takes the birth country as nationality, so an unknown code becomes null plus a warning.
export function birthCountry(
  value: string | undefined,
  where: string,
  warnings: string[],
): CountryCode | null {
  if (value === undefined) return null;
  const parsed = countryCodeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  warnings.push(`${where}: unknown birthCountry "${value}"`);
  return null;
}
